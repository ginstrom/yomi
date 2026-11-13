import numpy as np
import pytest

from yomi_audio import dsp

SR = 48000


def sine(hz, seconds=0.5, amp=0.5):
    t = np.arange(int(seconds * SR)) / SR
    return amp * np.sin(2 * np.pi * hz * t)


def rms(x):
    return float(np.sqrt(np.mean(x**2)))


def rms_db_change(before, after):
    # Ignore the filters' first 50 ms of settling.
    cut = SR // 20
    return 20 * np.log10(rms(after[cut:]) / rms(before[cut:]))


@pytest.mark.parametrize(
    "spec, inside, outside",
    [
        ({"type": "highpass", "hz": 2000}, 8000, 100),
        ({"type": "lowpass", "hz": 500}, 100, 8000),
        ({"type": "bandpass", "hz": 1000, "q": 4}, 1000, 8000),
        ({"type": "bandpass", "hz": 1000, "q": 4}, 1000, 120),
    ],
)
def test_filters_attenuate_out_of_band(spec, inside, outside):
    keep = rms_db_change(sine(inside), dsp.apply_filter(sine(inside), SR, spec))
    cut = rms_db_change(sine(outside), dsp.apply_filter(sine(outside), SR, spec))
    assert keep > -3.5
    assert cut < -18


def test_peak_and_shelves_change_gain_where_asked():
    peak = {"type": "peak", "hz": 1000, "gain_db": 9, "q": 2}
    assert rms_db_change(sine(1000), dsp.apply_filter(sine(1000), SR, peak)) == pytest.approx(9, abs=0.5)
    assert abs(rms_db_change(sine(100), dsp.apply_filter(sine(100), SR, peak))) < 1
    low = {"type": "lowshelf", "hz": 300, "gain_db": -12}
    assert rms_db_change(sine(50), dsp.apply_filter(sine(50), SR, low)) == pytest.approx(-12, abs=1)
    assert abs(rms_db_change(sine(5000), dsp.apply_filter(sine(5000), SR, low))) < 1
    high = {"type": "highshelf", "hz": 3000, "gain_db": 6}
    assert rms_db_change(sine(12000), dsp.apply_filter(sine(12000), SR, high)) == pytest.approx(6, abs=1)


def test_swept_lowpass_opens_over_the_layer():
    noise = np.random.default_rng(1).standard_normal(SR)
    y = dsp.apply_filter(noise, SR, {"type": "lowpass", "hz": 200, "hz_end": 10000})
    first, last = y[: SR // 4], y[-SR // 4 :]
    # High-frequency content (first difference) grows as the filter opens.
    assert rms(np.diff(last)) > 5 * rms(np.diff(first))


def test_pitch_up_an_octave_halves_the_length():
    x = sine(440, 1.0)
    y = dsp.pitch_shift(x, 12.0)
    assert len(y) == pytest.approx(len(x) / 2, abs=2)
    down = dsp.pitch_shift(x, -12.0)
    assert len(down) == pytest.approx(len(x) * 2, abs=2)
    assert dsp.pitch_shift(x, 0.0) is x or np.array_equal(dsp.pitch_shift(x, 0.0), x)


def test_pitch_up_raises_the_frequency():
    y = dsp.pitch_shift(sine(440, 1.0), 12.0)
    spectrum = np.abs(np.fft.rfft(y))
    hz = np.argmax(spectrum) * SR / len(y)
    assert hz == pytest.approx(880, abs=5)


def test_envelope_hits_its_points_and_holds_the_ends():
    gain = dsp.envelope_gain(SR, SR, [[0, -6], [500, 0], [800, -60]])
    assert 20 * np.log10(gain[0]) == pytest.approx(-6, abs=0.01)
    assert 20 * np.log10(gain[SR // 2]) == pytest.approx(0, abs=0.01)
    assert 20 * np.log10(gain[int(0.8 * SR)]) == pytest.approx(-60, abs=0.01)
    assert 20 * np.log10(gain[-1]) == pytest.approx(-60, abs=0.01)
    # Linear in dB between points.
    assert 20 * np.log10(gain[SR // 4]) == pytest.approx(-3, abs=0.01)


def test_fades_start_and_end_at_silence():
    x = np.ones(SR)
    y = dsp.fade_out(dsp.fade_in(x, SR, 10), SR, 20)
    assert y[0] == 0 and y[-1] == 0
    assert y[SR // 2] == 1
    assert np.all(y[: 480] <= 1)


def test_saturate_keeps_full_scale_and_compresses_peaks():
    x = sine(200, 0.5, amp=1.0)
    y = dsp.saturate(x, 12)
    assert np.max(np.abs(y)) == pytest.approx(1.0, abs=1e-6)
    assert rms(y) > rms(x)


def test_limiter_never_exceeds_its_ceiling():
    rng = np.random.default_rng(5)
    x = rng.standard_normal(SR) * 0.6
    x[1000] = 3.0
    y = dsp.limit(x, SR, -3.0)
    assert np.max(np.abs(y)) <= 10 ** (-3 / 20) + 1e-12
    # Quiet material passes untouched.
    q = sine(300, 0.2, amp=0.1)
    assert np.allclose(dsp.limit(q, SR, -3.0), q)


def test_compressor_reduces_loud_parts_more_than_quiet():
    loud, quiet = sine(500, 0.5, 0.9), sine(500, 0.5, 0.05)
    c = dict(threshold_db=-20, ratio=4, attack_ms=1, release_ms=50)
    assert rms(dsp.compress(loud, SR, **c)) < 0.5 * rms(loud)
    assert rms(dsp.compress(quiet, SR, **c)) == pytest.approx(rms(quiet), rel=0.01)


def test_trim_keeps_the_tail_asked_for():
    x = np.zeros(SR)
    x[:4800] = sine(1000, 0.1, 0.5)
    y = dsp.trim(x, SR, threshold_db=-40, keep_tail_ms=30)
    last_loud = np.nonzero(np.abs(x) >= 0.5 * 10 ** (-40 / 20))[0][-1]
    assert len(y) == last_loud + 1 + int(round(0.030 * SR))
    assert np.array_equal(y, x[: len(y)])


def test_reverb_adds_a_tail_after_its_predelay():
    x = np.zeros(4800)
    x[0] = 1.0
    ir = np.exp(-np.arange(9600) / 2000) * np.random.default_rng(2).standard_normal(9600)
    y = dsp.reverb(x, SR, ir, wet_db=-6, predelay_ms=10)
    assert len(y) >= len(x) + len(ir)
    pre = int(0.010 * SR)
    assert np.allclose(y[1:pre], 0)
    assert np.any(np.abs(y[pre:]) > 0)
    assert y[0] == 1.0


def test_delay_repeats_the_sound():
    x = np.zeros(480)
    x[0] = 1.0
    y = dsp.delay(x, SR, ms=100, feedback=0.5, wet_db=-6)
    d = int(0.1 * SR)
    assert y[d] == pytest.approx(10 ** (-6 / 20))
    assert y[2 * d] == pytest.approx(10 ** (-6 / 20) * 0.5)
    assert y[0] == 1.0
