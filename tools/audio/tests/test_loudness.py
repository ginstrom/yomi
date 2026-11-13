import numpy as np
import pytest

from yomi_audio import loudness
from yomi_audio.errors import AudioError

SR = 48000


def sine(hz, seconds, amp=1.0, sr=SR):
    t = np.arange(int(seconds * sr)) / sr
    return amp * np.sin(2 * np.pi * hz * t)


def test_full_scale_997hz_sine_is_minus_3_01_lufs_integrated():
    assert loudness.integrated(sine(997, 3.0), SR) == pytest.approx(-3.01, abs=0.2)


def test_full_scale_997hz_sine_momentary_max_matches():
    assert loudness.momentary_max(sine(997, 2.0), SR) == pytest.approx(-3.01, abs=0.2)


def test_level_tracks_amplitude():
    quiet = sine(1000, 2.0, amp=10 ** (-20 / 20))
    assert loudness.momentary_max(quiet, SR) == pytest.approx(-23.0, abs=0.2)


def test_short_click_is_padded_before_measuring():
    click = np.zeros(480)  # 10 ms, far shorter than a 400 ms window
    click[10:20] = 0.5
    value = loudness.momentary_max(click, SR)
    assert np.isfinite(value)
    # The same click inside 400 ms of silence measures the same.
    padded = np.concatenate([np.zeros(SR), click, np.zeros(SR)])
    assert loudness.momentary_max(padded, SR) == pytest.approx(value, abs=0.05)
    assert np.isfinite(loudness.integrated(click, SR))


def test_silence_measures_minus_infinity():
    assert loudness.momentary_max(np.zeros(1000), SR) == -np.inf
    assert loudness.integrated(np.zeros(1000), SR) == -np.inf


@pytest.mark.parametrize("how", ["momentary_max", "integrated"])
def test_normalise_lands_on_target(how):
    x = sine(440, 0.6, amp=0.3) * np.linspace(1, 0, int(0.6 * SR))
    y = loudness.normalise(x, SR, how, -19.0)
    assert loudness.measure(y, SR, how) == pytest.approx(-19.0, abs=0.1)


def test_normalising_silence_is_an_error_naming_it():
    with pytest.raises(AudioError, match="battle.x#2"):
        loudness.normalise(np.zeros(100), SR, "momentary_max", -19, what="battle.x#2")


def test_unknown_measure_is_an_error():
    with pytest.raises(AudioError, match="loudest"):
        loudness.measure(sine(440, 0.5), SR, "loudest")


def test_true_peak_exceeds_sample_peak_on_intersample_peak():
    # A sine at a quarter of the rate, sampled 45 degrees off its crests:
    # every sample is at 0.707 of the true crest.
    n = np.arange(4800)
    x = np.sin(2 * np.pi * n / 4 + np.pi / 4)
    assert loudness.sample_peak_db(x) == pytest.approx(-3.01, abs=0.05)
    assert loudness.true_peak_db(x) > loudness.sample_peak_db(x) + 2.0
