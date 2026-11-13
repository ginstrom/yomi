import numpy as np
import pytest

from yomi_audio import synth

SR = 48000


def rng():
    return np.random.default_rng([1, 2])


def dominant_hz(x):
    spectrum = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    return np.argmax(spectrum) * SR / len(x)


@pytest.mark.parametrize("kind", ["sine", "triangle", "saw", "square"])
def test_oscillators_have_length_pitch_and_full_scale(kind):
    x = synth.render({"kind": kind, "hz": 440, "length": 500}, SR, rng())
    assert len(x) == SR // 2
    assert dominant_hz(x) == pytest.approx(440, abs=5)
    assert 0.9 <= np.max(np.abs(x)) <= 1.1


def test_sweep_exp_and_lin_end_where_asked():
    for curve in ("lin", "exp"):
        x = synth.render({"kind": "sine", "hz": 2000, "hz_end": 200, "curve": curve, "length": 1000}, SR, rng())
        assert dominant_hz(x[: SR // 20]) == pytest.approx(2000, rel=0.1)
        assert dominant_hz(x[-SR // 20 :]) == pytest.approx(200, rel=0.25)
    lin = synth.render({"kind": "sine", "hz": 2000, "hz_end": 200, "curve": "lin", "length": 1000}, SR, rng())
    exp = synth.render({"kind": "sine", "hz": 2000, "hz_end": 200, "curve": "exp", "length": 1000}, SR, rng())
    middle = slice(int(0.45 * SR), int(0.55 * SR))
    assert dominant_hz(lin[middle]) == pytest.approx(1100, rel=0.1)
    assert dominant_hz(exp[middle]) == pytest.approx(632, rel=0.1)


def band_energy(x, lo, hi):
    spectrum = np.abs(np.fft.rfft(x)) ** 2
    hz = np.fft.rfftfreq(len(x), 1 / SR)
    return spectrum[(hz >= lo) & (hz < hi)].sum()


def test_noise_colours_tilt_darker():
    tilt = {}
    for colour in ("white", "pink", "brown"):
        x = synth.render({"kind": "noise", "color": colour, "length": 1000}, SR, rng())
        assert len(x) == SR and np.max(np.abs(x)) == pytest.approx(1.0)
        tilt[colour] = band_energy(x, 100, 1000) / band_energy(x, 5000, 14000)
    assert tilt["white"] < tilt["pink"] < tilt["brown"]


def test_noise_follows_the_generator():
    a = synth.render({"kind": "noise", "length": 50}, SR, np.random.default_rng([3, 0]))
    b = synth.render({"kind": "noise", "length": 50}, SR, np.random.default_rng([3, 0]))
    c = synth.render({"kind": "noise", "length": 50}, SR, np.random.default_rng([3, 1]))
    assert np.array_equal(a, b) and not np.array_equal(a, c)


def test_fm_has_sidebands_that_fade_with_the_index():
    x = synth.render({"kind": "fm", "carrier_hz": 500, "ratio": 2, "index": 5, "index_end": 0, "length": 1000}, SR, rng())
    assert len(x) == SR
    early, late = x[: SR // 5], x[-SR // 5 :]
    assert band_energy(early, 1600, 6000) > 10 * band_energy(late, 1600, 6000)


def test_crackle_density_sets_how_many_clicks():
    sparse = synth.render({"kind": "crackle", "density": 10, "click_ms": 1, "length": 2000}, SR, rng())
    dense = synth.render({"kind": "crackle", "density": 200, "click_ms": 1, "length": 2000}, SR, rng())
    def onsets(x):
        active = np.abs(x) > 1e-3
        return np.count_nonzero(active[1:] & ~active[:-1])
    assert onsets(dense) > 5 * onsets(sparse) > 0


def test_impulse_is_one_click():
    x = synth.render({"kind": "impulse", "length": 40}, SR, rng())
    assert len(x) == int(0.04 * SR)
    assert x[0] == 1.0 and np.count_nonzero(x) == 1
