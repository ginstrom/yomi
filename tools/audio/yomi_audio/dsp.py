"""DSP primitives, all on mono float64 arrays.

Everything here is deterministic: no randomness, no threading, scipy's
single-worker FFT for convolution. Times are in milliseconds and levels in dB,
as recipes write them.
"""
from fractions import Fraction

import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import fftconvolve, lfilter, lfilter_zi, resample_poly

DEFAULT_Q = 0.7071
SWEEP_BLOCK = 32


def db2lin(db: float) -> float:
    return 10.0 ** (db / 20.0)


def lin2db(gain: float) -> float:
    return 20.0 * np.log10(gain) if gain > 0 else -np.inf


def samples(ms: float, sr: int) -> int:
    return max(0, int(round(ms * sr / 1000.0)))


# Filters ---------------------------------------------------------------------


def biquad(kind: str, hz: float, sr: int, q: float = DEFAULT_Q, gain_db: float = 0.0):
    """RBJ cookbook coefficients (b, a), normalised so a[0] = 1."""
    hz = min(max(hz, 1.0), 0.49 * sr)
    w0 = 2 * np.pi * hz / sr
    cos, sin = np.cos(w0), np.sin(w0)
    alpha = sin / (2 * q)
    a_gain = 10 ** (gain_db / 40)
    if kind == "lowpass":
        b = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == "highpass":
        b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == "bandpass":  # constant 0 dB peak gain
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cos, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * a_gain, -2 * cos, 1 - alpha * a_gain]
        a = [1 + alpha / a_gain, -2 * cos, 1 - alpha / a_gain]
    elif kind in ("lowshelf", "highshelf"):
        root = 2 * np.sqrt(a_gain) * alpha
        sign = 1 if kind == "lowshelf" else -1
        b = [
            a_gain * ((a_gain + 1) - sign * (a_gain - 1) * cos + root),
            sign * 2 * a_gain * ((a_gain - 1) - sign * (a_gain + 1) * cos),
            a_gain * ((a_gain + 1) - sign * (a_gain - 1) * cos - root),
        ]
        a = [
            (a_gain + 1) + sign * (a_gain - 1) * cos + root,
            -sign * 2 * ((a_gain - 1) + sign * (a_gain + 1) * cos),
            (a_gain + 1) + sign * (a_gain - 1) * cos - root,
        ]
    else:
        raise ValueError(f"unknown filter type '{kind}'")
    b, a = np.array(b, dtype=np.float64), np.array(a, dtype=np.float64)
    return b / a[0], a / a[0]


def apply_filter(x: np.ndarray, sr: int, spec: dict) -> np.ndarray:
    """One filter of a recipe's `filter` list.

    With `hz_end`, the cutoff (or centre) moves geometrically from `hz` to
    `hz_end` over the signal, the coefficients changing every 32 samples with
    the filter's state carried across.
    """
    kind = spec["type"]
    q = spec.get("q", DEFAULT_Q)
    gain_db = spec.get("gain_db", 0.0)
    x = np.asarray(x, dtype=np.float64)
    hz_end = spec.get("hz_end")
    if hz_end is None or len(x) == 0:
        b, a = biquad(kind, spec["hz"], sr, q, gain_db)
        return lfilter(b, a, x)
    out = np.empty_like(x)
    start, end = max(spec["hz"], 1.0), max(hz_end, 1.0)
    state = None
    for i in range(0, len(x), SWEEP_BLOCK):
        block = x[i : i + SWEEP_BLOCK]
        position = (i + len(block) / 2) / len(x)
        b, a = biquad(kind, start * (end / start) ** position, sr, q, gain_db)
        if state is None:
            state = lfilter_zi(b, a) * 0.0
        out[i : i + len(block)], state = lfilter(b, a, block, zi=state)
    return out


# Time and shape ----------------------------------------------------------------


def pitch_shift(x: np.ndarray, semitones: float) -> np.ndarray:
    """Resamples by 2^(semitones/12): up is shorter and higher, as tape is."""
    if abs(semitones) < 1e-9 or len(x) == 0:
        return x
    ratio = Fraction(2 ** (semitones / 12)).limit_denominator(512)
    return resample_poly(np.asarray(x, dtype=np.float64), ratio.denominator, ratio.numerator)


def envelope_gain(n: int, sr: int, points) -> np.ndarray:
    """Linear gain over `n` samples from [[ms, dB], ...], linear in dB between
    points and held flat before the first and after the last."""
    ms = np.array([p[0] for p in points], dtype=np.float64)
    db = np.array([p[1] for p in points], dtype=np.float64)
    t = np.arange(n) * 1000.0 / sr
    return 10 ** (np.interp(t, ms, db) / 20)


def apply_envelope(x: np.ndarray, sr: int, points) -> np.ndarray:
    return x * envelope_gain(len(x), sr, points)


def fade_in(x: np.ndarray, sr: int, ms: float) -> np.ndarray:
    n = min(samples(ms, sr), len(x))
    if n == 0:
        return x
    y = np.array(x, dtype=np.float64)
    y[:n] *= np.arange(n) / n
    return y


def fade_out(x: np.ndarray, sr: int, ms: float) -> np.ndarray:
    n = min(samples(ms, sr), len(x))
    if n == 0:
        return x
    y = np.array(x, dtype=np.float64)
    y[len(y) - n :] *= np.arange(n - 1, -1, -1) / n
    return y


def saturate(x: np.ndarray, drive_db: float) -> np.ndarray:
    """tanh soft clipping, scaled so that full scale stays full scale."""
    g = db2lin(drive_db)
    return np.tanh(g * x) / np.tanh(g)


# Dynamics ----------------------------------------------------------------------


def compress(x, sr, threshold_db, ratio, attack_ms=5.0, release_ms=50.0):
    """A feed-forward peak compressor; no make-up gain (loudness is set last)."""
    x = np.asarray(x, dtype=np.float64)
    with np.errstate(divide="ignore"):
        level = 20 * np.log10(np.abs(x))
    target = np.maximum(level - threshold_db, 0.0) * (1 - 1 / ratio)
    attack = np.exp(-1.0 / max(attack_ms * sr / 1000, 1e-9))
    release = np.exp(-1.0 / max(release_ms * sr / 1000, 1e-9))
    reduction = np.empty_like(x)
    current = 0.0
    for i, wanted in enumerate(target.tolist()):
        coeff = attack if wanted > current else release
        current = coeff * current + (1 - coeff) * wanted
        reduction[i] = current
    return x * 10 ** (-reduction / 20)


def limit(x, sr, ceiling_db, release_ms=50.0, lookahead_ms=1.5):
    """A look-ahead brickwall limiter: no sample leaves above the ceiling.

    The gain at each sample is no more than what every sample within the
    look-ahead needs, smoothed over it, then released exponentially.
    """
    x = np.asarray(x, dtype=np.float64)
    if len(x) == 0:
        return x
    ceiling = db2lin(ceiling_db)
    peaks = np.abs(x)
    needed = np.minimum(1.0, ceiling / np.maximum(peaks, 1e-300))
    if np.all(needed >= 1.0):
        return x.copy()
    half = max(1, samples(lookahead_ms, sr) // 2)
    floor = minimum_filter1d(needed, size=4 * half + 1, mode="nearest")
    smooth = np.minimum(uniform_filter1d(floor, size=2 * half + 1, mode="nearest"), needed)
    release = np.exp(-1.0 / max(release_ms * sr / 1000, 1e-9))
    gain = np.empty_like(smooth)
    current = 1.0
    for i, wanted in enumerate(smooth.tolist()):
        recovered = 1.0 - (1.0 - current) * release
        current = wanted if wanted < recovered else recovered
        gain[i] = current
    return np.clip(x * gain, -ceiling, ceiling)


def trim(x, sr, threshold_db=-60.0, keep_tail_ms=20.0):
    """Cuts the end after the last sample within `threshold_db` of the peak,
    keeping `keep_tail_ms` after it. The start is never trimmed (its timing
    belongs to the cue)."""
    x = np.asarray(x, dtype=np.float64)
    peak = np.max(np.abs(x)) if len(x) else 0.0
    if peak == 0:
        return x
    loud = np.nonzero(np.abs(x) >= peak * db2lin(threshold_db))[0]
    end = min(len(x), loud[-1] + 1 + samples(keep_tail_ms, sr))
    return x[:end]


# Space -------------------------------------------------------------------------


def reverb(x, sr, ir, wet_db=-12.0, predelay_ms=0.0):
    """Convolution reverb added to the dry signal. The impulse is scaled to unit
    energy, so `wet_db` is the reverb's level against the dry sound whatever the
    impulse's length."""
    x = np.asarray(x, dtype=np.float64)
    ir = np.asarray(ir, dtype=np.float64)
    energy = np.sqrt(np.sum(ir**2))
    if energy == 0 or len(x) == 0:
        return x
    wet = fftconvolve(x, ir / energy) * db2lin(wet_db)
    pre = samples(predelay_ms, sr)
    out = np.zeros(max(len(x), pre + len(wet)))
    out[: len(x)] += x
    out[pre : pre + len(wet)] += wet
    return out


def delay(x, sr, ms, feedback=0.3, wet_db=-12.0, floor_db=-60.0, max_repeats=32):
    """Echoes every `ms`, the first at `wet_db`, each next one `feedback` times
    the last, until they fall below `floor_db`."""
    x = np.asarray(x, dtype=np.float64)
    step = max(1, samples(ms, sr))
    gains = []
    gain = db2lin(wet_db)
    while gain >= db2lin(floor_db) and len(gains) < max_repeats:
        gains.append(gain)
        gain *= feedback
        if feedback <= 0:
            break
    out = np.zeros(len(x) + step * len(gains))
    out[: len(x)] += x
    for n, g in enumerate(gains, start=1):
        out[n * step : n * step + len(x)] += g * x
    return out
