"""Synthesis generators for a layer's `synth = { kind = ..., ... }`.

Each returns `length` ms of mono float64 at about full scale; the layer's gain,
envelope and the cue's normalisation set its level. Randomness (noise,
crackle) comes only from the generator passed in.
"""
import numpy as np
from scipy.signal import lfilter

KINDS = ("sine", "triangle", "saw", "square", "noise", "fm", "crackle", "impulse")
OSCILLATORS = ("sine", "triangle", "saw", "square")
COLOURS = ("white", "pink", "brown")
CURVES = ("lin", "exp")

# Paul Kellet's economy pink filter (-3 dB/octave within 0.5 dB, 20 Hz–20 kHz).
_PINK_B = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
_PINK_A = [1.0, -2.494956002, 2.017265875, -0.522189400]


def _count(spec, sr) -> int:
    return max(1, int(round(spec["length"] * sr / 1000.0)))


def _peak_normalised(x: np.ndarray) -> np.ndarray:
    peak = np.max(np.abs(x))
    return x / peak if peak > 0 else x


def frequency_track(start: float, end: float | None, curve: str, n: int) -> np.ndarray:
    if end is None or end == start:
        return np.full(n, float(start))
    position = np.arange(n) / max(n - 1, 1)
    if curve == "lin":
        return start + (end - start) * position
    start, end = max(start, 1e-3), max(end, 1e-3)
    return start * (end / start) ** position


def _poly_blep(phase: np.ndarray, step: np.ndarray) -> np.ndarray:
    """The band-limiting correction for a step at phase 0 (PolyBLEP)."""
    out = np.zeros_like(phase)
    rising = phase < step
    t = phase[rising] / step[rising]
    out[rising] = t + t - t * t - 1
    falling = phase > 1 - step
    t = (phase[falling] - 1) / step[falling]
    out[falling] = t * t + t + t + 1
    return out


def _oscillator(kind, spec, sr, n):
    hz = frequency_track(spec["hz"], spec.get("hz_end"), spec.get("curve", "exp"), n)
    step = np.clip(hz / sr, 1e-9, 0.5)
    phase = np.concatenate([[0.0], np.cumsum(step)[:-1]]) % 1.0
    if kind == "sine":
        return np.sin(2 * np.pi * phase)
    if kind == "triangle":
        return 1 - 4 * np.abs(phase - 0.5)
    if kind == "saw":
        return 2 * phase - 1 - _poly_blep(phase, step)
    square = np.where(phase < 0.5, 1.0, -1.0)
    return square + _poly_blep(phase, step) - _poly_blep((phase + 0.5) % 1.0, step)


def _noise(spec, n, rng):
    white = rng.standard_normal(n)
    colour = spec.get("color", "white")
    if colour == "pink":
        white = lfilter(_PINK_B, _PINK_A, white)
    elif colour == "brown":
        white = lfilter([1.0], [1.0, -0.998], white)
        white = white - np.mean(white)
    return _peak_normalised(white)


def _fm(spec, sr, n):
    carrier = spec["carrier_hz"]
    ratio = spec.get("ratio", 1.0)
    index = spec.get("index", 1.0)
    index_end = spec.get("index_end", index)
    t = np.arange(n) / sr
    depth = index + (index_end - index) * np.arange(n) / max(n - 1, 1)
    return np.sin(2 * np.pi * carrier * t + depth * np.sin(2 * np.pi * carrier * ratio * t))


def _crackle(spec, sr, n, rng):
    seconds = n / sr
    clicks = rng.poisson(spec["density"] * seconds)
    starts = np.sort(rng.integers(0, n, size=clicks))
    amplitudes = rng.uniform(0.3, 1.0, size=clicks) * rng.choice([-1.0, 1.0], size=clicks)
    width = max(1, int(round(spec.get("click_ms", 2.0) * sr / 1000)))
    shape = np.exp(-np.arange(width) / max(width / 4, 1)) * rng.standard_normal(width)
    shape /= np.max(np.abs(shape)) or 1.0
    out = np.zeros(n + width)
    for start, amplitude in zip(starts.tolist(), amplitudes.tolist()):
        out[start : start + width] += amplitude * shape
    return _peak_normalised(out[:n])


def render(spec: dict, sr: int, rng: np.random.Generator) -> np.ndarray:
    """Renders a resolved synth table (every range already drawn)."""
    kind = spec["kind"]
    n = _count(spec, sr)
    if kind in OSCILLATORS:
        return _oscillator(kind, spec, sr, n)
    if kind == "noise":
        return _noise(spec, n, rng)
    if kind == "fm":
        return _fm(spec, sr, n)
    if kind == "crackle":
        return _crackle(spec, sr, n, rng)
    if kind == "impulse":
        out = np.zeros(n)
        out[0] = 1.0
        return out
    raise ValueError(f"unknown synth kind '{kind}'")
