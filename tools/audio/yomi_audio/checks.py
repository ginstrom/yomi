"""The checks every built variant must pass (C6), shared by `sfx build`,
which enforces them, and `sfx audition`, which only shows them.

- Loudness within the group's tolerance of its target, or under the target
  because the true-peak ceiling bound the normalising gain first
  (`peak-limited`: a sound shorter than the 400 ms window, such as a click,
  may need more gain to reach a momentary target than its peak allows).
- True peak at or under the group's ceiling.
- Length within the recipe's `max_ms`.
- DC offset (the mean sample) at most 0.5% of full scale.
- Across a cue's variants: no two with a peak normalised cross-correlation
  above 0.95 (a one-variant cue is exempt).
"""
from dataclasses import dataclass

import numpy as np
from scipy.signal import fftconvolve

from . import loudness
from .config import Group

MAX_DC = 0.005
MAX_CORRELATION = 0.95
# A peak this close under its ceiling (after the normaliser's own margin)
# means the ceiling set the gain.
LIMITED_WITHIN_DB = loudness.PEAK_MARGIN_DB + 0.05
LABEL = {"momentary_max": "LUFS-M max", "integrated": "LUFS-I"}


@dataclass(frozen=True)
class Measured:
    cue: str
    k: int
    group: str
    loudness: float
    true_peak: float
    length_ms: float
    dc: float
    peak_limited: bool
    loudness_ok: bool
    peak_ok: bool
    length_ok: bool
    dc_ok: bool

    @property
    def ok(self) -> bool:
        return self.loudness_ok and self.peak_ok and self.length_ok and self.dc_ok


def measure_variant(cue: str, k: int, x: np.ndarray, sr: int, group: Group, max_ms: float | None) -> Measured:
    level = loudness.measure(x, sr, group.measure)
    peak = loudness.true_peak_db(x)
    limited = bool(level < group.target and peak >= group.peak - LIMITED_WITHIN_DB)
    length = 1000 * len(x) / sr
    dc = float(np.mean(x)) if len(x) else 0.0
    return Measured(
        cue=cue,
        k=k,
        group=group.name,
        loudness=level,
        true_peak=peak,
        length_ms=length,
        dc=dc,
        peak_limited=limited and abs(level - group.target) > group.tolerance,
        loudness_ok=abs(level - group.target) <= group.tolerance or limited,
        peak_ok=peak <= group.peak,
        length_ok=max_ms is None or length <= max_ms,
        dc_ok=abs(dc) <= MAX_DC,
    )


def failures(m: Measured, group: Group, max_ms: float | None) -> list[str]:
    """One line per failed check, naming the variant, the value and the limit."""
    where = f"{m.cue}#{m.k}"
    out = []
    if not m.loudness_ok:
        out.append(
            f"{where}: loudness {m.loudness:.1f} {LABEL[group.measure]}, outside "
            f"{group.target:g} ±{group.tolerance:g} (group {group.name})"
        )
    if not m.peak_ok:
        out.append(f"{where}: true peak {m.true_peak:.2f} dBTP over the ceiling {group.peak:g} (group {group.name})")
    if not m.length_ok:
        out.append(f"{where}: {m.length_ms:.0f} ms is longer than max_ms {max_ms:g}")
    if not m.dc_ok:
        out.append(f"{where}: DC offset {100 * m.dc:+.2f}% of full scale, over {100 * MAX_DC:g}%")
    return out


def correlation(a: np.ndarray, b: np.ndarray) -> float:
    """The peak of the normalised cross-correlation of two sounds, over every
    lag (0 for silence). 1 means one is a shifted, scaled copy of the other."""
    norm = float(np.linalg.norm(a) * np.linalg.norm(b))
    if norm == 0:
        return 0.0
    return float(np.max(np.abs(fftconvolve(a, b[::-1])))) / norm


def correlation_failures(cue: str, variants: list[np.ndarray]) -> list[str]:
    out = []
    for i in range(len(variants)):
        for j in range(i + 1, len(variants)):
            c = correlation(variants[i], variants[j])
            if c > MAX_CORRELATION:
                out.append(
                    f"{cue}: variants #{i} and #{j} correlate at {c:.3f}, over {MAX_CORRELATION:g} "
                    "(make them differ more)"
                )
    return out
