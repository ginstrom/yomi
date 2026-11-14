"""`sfx audition`: a cue's variants as WAV files, measured, for listening.

Writes `<cue>.v<k>.wav` (48 kHz float) into `--out` (or
`<root>/.audition/<cue>/`; with several cues, a folder per cue under `--out`),
and with `--spectrogram` a PNG beside each: the waveform over a log-frequency
spectrogram in dB, titled with the cue, variant, loudness, true peak and
length. Prints a table of each variant's loudness by its group's measure,
true peak and length, each marked against the group's tolerance, ceiling and
the recipe's `max_ms`. Nothing is judged here: `sfx build` (step 02) enforces.
"""
from dataclasses import dataclass, replace
from pathlib import Path

import numpy as np
import soundfile as sf

from . import checks
from .config import load_config
from .errors import AudioError
from .recipe import load_recipe, render_variant
from .sources import Registry

def mark(ok: bool) -> str:
    return "ok" if ok else "!!"


MEASURE_LABEL = checks.LABEL


@dataclass(frozen=True)
class Row:
    cue: str
    k: int
    wav: Path
    png: Path | None
    loudness: float
    loudness_ok: bool
    peak_limited: bool
    true_peak: float
    peak_ok: bool
    length_ms: float
    length_ok: bool


def _spectrogram(path: Path, x: np.ndarray, sr: int, title: str):
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        raise AudioError("--spectrogram needs matplotlib (the tool's dev group: uv run --project tools/audio ...)") from None
    from scipy.signal import spectrogram

    t = np.arange(len(x)) / sr
    figure, (wave, spec) = plt.subplots(
        2, 1, figsize=(8, 5), sharex=True, gridspec_kw={"height_ratios": [1, 3]}, constrained_layout=True
    )
    wave.plot(t, x, linewidth=0.5, color="#245")
    wave.set_ylim(-1, 1)
    wave.set_ylabel("amplitude")
    wave.set_title(title, fontsize=9)
    hz, seconds, power = spectrogram(x, sr, nperseg=1024, noverlap=896, window="hann", mode="psd")
    db = 10 * np.log10(np.maximum(power, 1e-14))
    image = spec.pcolormesh(seconds, np.maximum(hz, 1.0), db, shading="auto", cmap="magma", vmin=db.max() - 90, vmax=db.max())
    spec.set_yscale("log")
    spec.set_ylim(20, sr / 2)
    spec.set_ylabel("Hz")
    spec.set_xlabel("seconds")
    figure.colorbar(image, ax=spec, label="dB")
    figure.savefig(path, dpi=100)
    plt.close(figure)


def audition(root: Path, cues: list[str], out: Path | None = None, spectrogram: bool = False, echo=print) -> list[Row]:
    root = Path(root)
    config = load_config(root)
    registry = Registry.load(root)
    sr = config.sample_rate
    recipes = [load_recipe(config, cue) for cue in cues]  # every recipe checked before any render
    rows = []
    for recipe in recipes:
        group = recipe.group
        if out is None:
            folder = root / ".audition" / recipe.cue
        else:
            folder = Path(out) / recipe.cue if len(cues) > 1 else Path(out)
        folder.mkdir(parents=True, exist_ok=True)
        label = MEASURE_LABEL[group.measure]
        limit = f", max {recipe.max_ms:g} ms" if recipe.max_ms else ""
        echo(
            f"{recipe.cue}  group {group.name}: {group.target:g} {label} ±{group.tolerance:g}, "
            f"peak ≤ {group.peak:g} dBTP{limit}  -> {folder}"
        )
        echo(f"  {'var':>3}  {label:>11}  {'dBTP':>7}  {'ms':>7}")
        for k in range(recipe.variants):
            x = render_variant(recipe, k, registry, sr)
            wav = folder / f"{recipe.cue}.v{k}.wav"
            sf.write(wav, x.astype(np.float32), sr, subtype="FLOAT")
            m = checks.measure_variant(recipe.cue, k, x, sr, group, recipe.max_ms)
            level, peak, length = m.loudness, m.true_peak, m.length_ms
            row = Row(
                cue=recipe.cue,
                k=k,
                wav=wav,
                png=None,
                loudness=level,
                loudness_ok=m.loudness_ok,
                peak_limited=m.peak_limited,
                true_peak=peak,
                peak_ok=m.peak_ok,
                length_ms=length,
                length_ok=m.length_ok,
            )
            if spectrogram:
                png = wav.with_suffix(".png")
                _spectrogram(
                    png, x, sr,
                    f"{recipe.cue} #{k}   {level:.1f} {label}   {peak:.1f} dBTP   {length:.0f} ms",
                )
                row = replace(row, png=png)
            echo(
                f"  {k:>3}  {level:>7.1f} {'lim' if row.peak_limited else mark(row.loudness_ok)}  "
                f"{peak:>5.1f} {mark(row.peak_ok)}  "
                f"{length:>5.0f} {mark(row.length_ok)}"
            )
            rows.append(row)
    return rows
