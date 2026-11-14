"""Loudness (ITU-R BS.1770) and true peak.

Two measures, as `audio.toml`'s groups name them:

- ``momentary_max``: the loudest 400 ms window (100 ms hop) of the K-weighted
  signal, in LUFS. The sound is padded with 400 ms of silence on both sides,
  so a click shorter than a window is measured whole, and wherever it falls.
- ``integrated``: gated integrated loudness (LUFS-I), the sound padded with
  silence to at least 400 ms.

The K-weighting coefficients are written out here (`k_weighting_coefficients`)
rather than read from pyloudnorm, whose filters are private; pyloudnorm stays
a dependency as the tests' independent cross-check of LUFS-I.

True peak is the largest absolute sample after 4x oversampling, in dBTP.
"""
import numpy as np
from scipy.signal import lfilter, resample_poly

from .errors import AudioError

MEASURES = ("momentary_max", "integrated")
WINDOW_S = 0.4
HOP_S = 0.1
ABSOLUTE_GATE = -70.0
RELATIVE_GATE = -10.0
PEAK_MARGIN_DB = 0.05  # how far under a ceiling a peak-limited gain stops


def k_weighting_coefficients(sr: int):
    """The BS.1770 K-weighting at any rate: ((b, a) of the high shelf, (b, a)
    of the high pass). The analogue prototypes are libebur128's, which give
    the ITU's published 48 kHz coefficients (BS.1770-4, Tables 1 and 2)."""
    f0, gain_db, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = np.tan(np.pi * f0 / sr)
    vh = 10 ** (gain_db / 20)
    vb = vh**0.4996667741545416
    a0 = 1 + k / q + k * k
    shelf_b = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    shelf_a = [1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.13547087602444, 0.5003270373238773
    k = np.tan(np.pi * f0 / sr)
    a0 = 1 + k / q + k * k
    highpass_b = [1.0, -2.0, 1.0]
    highpass_a = [1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    return (shelf_b, shelf_a), (highpass_b, highpass_a)


def k_weight(x: np.ndarray, sr: int) -> np.ndarray:
    """The BS.1770 K-weighting (a high shelf, then a high pass)."""
    y = np.asarray(x, dtype=np.float64)
    for b, a in k_weighting_coefficients(sr):
        y = lfilter(b, a, y)
    return y


def _block_powers(z: np.ndarray, window: int, hop: int) -> np.ndarray:
    """Mean square of each `window`-long block of `z`, `hop` apart."""
    cumulative = np.concatenate([[0.0], np.cumsum(z)])
    starts = np.arange(0, len(z) - window + 1, hop)
    return (cumulative[starts + window] - cumulative[starts]) / window


def _lufs(power: float) -> float:
    return -0.691 + 10 * np.log10(power) if power > 0 else -np.inf


def momentary_max(x: np.ndarray, sr: int) -> float:
    x = np.asarray(x, dtype=np.float64)
    if not np.any(x):
        return -np.inf
    window = int(round(WINDOW_S * sr))
    hop = int(round(HOP_S * sr))
    padded = np.concatenate([np.zeros(window), x, np.zeros(window)])
    return _lufs(float(np.max(_block_powers(k_weight(padded, sr) ** 2, window, hop))))


def integrated(x: np.ndarray, sr: int) -> float:
    """Gated integrated loudness (BS.1770-4): 400 ms blocks overlapping by
    75%, an absolute gate at -70 LUFS, then a relative gate 10 LU under the
    blocks that passed it."""
    x = np.asarray(x, dtype=np.float64)
    if not np.any(x):
        return -np.inf
    window = int(round(WINDOW_S * sr))
    if len(x) < window:
        x = np.concatenate([x, np.zeros(window - len(x))])
    powers = _block_powers(k_weight(x, sr) ** 2, window, int(round(window / 4)))
    with np.errstate(divide="ignore"):
        levels = -0.691 + 10 * np.log10(powers)
    kept = powers[levels > ABSOLUTE_GATE]
    if not len(kept):
        return -np.inf
    relative = _lufs(float(np.mean(kept))) + RELATIVE_GATE
    with np.errstate(divide="ignore"):
        kept = kept[-0.691 + 10 * np.log10(kept) > relative]
    return _lufs(float(np.mean(kept))) if len(kept) else -np.inf


def sample_peak_db(x: np.ndarray) -> float:
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    return 20 * np.log10(peak) if peak > 0 else -np.inf


def true_peak_db(x: np.ndarray) -> float:
    x = np.asarray(x, dtype=np.float64)
    if not len(x):
        return -np.inf
    # Pad so that the interpolation filter's edges see silence, not a cut.
    padded = np.concatenate([np.zeros(32), x, np.zeros(32)])
    return sample_peak_db(resample_poly(padded, 4, 1))


def measure(x: np.ndarray, sr: int, how: str) -> float:
    if how == "momentary_max":
        return momentary_max(x, sr)
    if how == "integrated":
        return integrated(x, sr)
    raise AudioError(f"unknown loudness measure '{how}' (expected one of {', '.join(MEASURES)})")


def normalise_gain_db(
    x: np.ndarray, sr: int, how: str, target: float, peak_ceiling: float | None = None, what: str = "sound"
) -> tuple[float, bool]:
    """The gain that takes `x` to `target` LUFS by `how`, or, when that would
    put its true peak over `peak_ceiling`, the gain that leaves the peak just
    under the ceiling (the lesser of the two). Returns (gain dB, whether the
    ceiling bound it)."""
    level = measure(x, sr, how)
    if not np.isfinite(level):
        raise AudioError(f"{what}: is silent, so it cannot be normalised")
    gain = target - level
    if peak_ceiling is not None:
        room = peak_ceiling - PEAK_MARGIN_DB - true_peak_db(x)
        if room < gain:
            return room, True
    return gain, False


def normalise(
    x: np.ndarray, sr: int, how: str, target: float, what: str = "sound", peak_ceiling: float | None = None
) -> np.ndarray:
    """Scales `x` to `target` LUFS by `how`, or less if `peak_ceiling` (dBTP)
    would otherwise be passed (see `normalise_gain_db`)."""
    gain, _ = normalise_gain_db(x, sr, how, target, peak_ceiling, what)
    return np.asarray(x, dtype=np.float64) * 10 ** (gain / 20)
