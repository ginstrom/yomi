"""Loudness (ITU-R BS.1770) and true peak.

Two measures, as `audio.toml`'s groups name them:

- ``momentary_max``: the loudest 400 ms window (100 ms hop) of the K-weighted
  signal, in LUFS. The sound is padded with 400 ms of silence on both sides,
  so a click shorter than a window is measured whole, and wherever it falls.
- ``integrated``: gated integrated loudness (LUFS-I), the sound padded with
  silence to at least 400 ms.

True peak is the largest absolute sample after 4x oversampling, in dBTP.
"""
import numpy as np
import pyloudnorm
from scipy.signal import lfilter, resample_poly

from .errors import AudioError

MEASURES = ("momentary_max", "integrated")
WINDOW_S = 0.4
HOP_S = 0.1
_meters: dict[int, pyloudnorm.Meter] = {}


def _meter(sr: int) -> pyloudnorm.Meter:
    if sr not in _meters:
        _meters[sr] = pyloudnorm.Meter(sr)
    return _meters[sr]


def k_weight(x: np.ndarray, sr: int) -> np.ndarray:
    """The BS.1770 K-weighting (a high shelf, then a high pass)."""
    meter = _meter(sr)
    y = np.asarray(x, dtype=np.float64)
    for name in ("high_shelf", "high_pass"):
        f = meter._filters[name]
        y = lfilter(f.b, f.a, y) * f.passband_gain
    return y


def momentary_max(x: np.ndarray, sr: int) -> float:
    x = np.asarray(x, dtype=np.float64)
    if not np.any(x):
        return -np.inf
    window = int(round(WINDOW_S * sr))
    hop = int(round(HOP_S * sr))
    padded = np.concatenate([np.zeros(window), x, np.zeros(window)])
    z = k_weight(padded, sr) ** 2
    cumulative = np.concatenate([[0.0], np.cumsum(z)])
    starts = np.arange(0, len(z) - window + 1, hop)
    means = (cumulative[starts + window] - cumulative[starts]) / window
    loudest = float(np.max(means))
    if loudest <= 0:
        return -np.inf
    return -0.691 + 10 * np.log10(loudest)


def integrated(x: np.ndarray, sr: int) -> float:
    x = np.asarray(x, dtype=np.float64)
    if not np.any(x):
        return -np.inf
    minimum = int(round(WINDOW_S * sr)) + 1
    if len(x) < minimum:
        x = np.concatenate([x, np.zeros(minimum - len(x))])
    with np.errstate(divide="ignore"):
        return float(_meter(sr).integrated_loudness(x))


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


def normalise(x: np.ndarray, sr: int, how: str, target: float, what: str = "sound") -> np.ndarray:
    """Scales `x` so that its loudness by `how` is `target` LUFS."""
    level = measure(x, sr, how)
    if not np.isfinite(level):
        raise AudioError(f"{what}: is silent, so it cannot be normalised")
    return np.asarray(x, dtype=np.float64) * 10 ** ((target - level) / 20)
