"""Reverb impulses: `impulses/<name>.toml` rendered to `<name>.flac`.

An impulse is exponentially decaying noise: `length` ms of white noise (made
sparse by `density`, the share of samples kept), falling 60 dB every `rt60`
seconds, through an optional `filter` list (a recipe's filters; a lowpass
whose `hz_end` is lower than its `hz` darkens the tail as a room absorbs the
highs), faded over its last 5 ms and peak-normalised to -1 dBFS. Each is
registered in `sources.toml` as `impulse_<name>`, licence "own", so a
recipe's `reverb = { impulse = "<name>" }` is verified like any source.
"""
import datetime
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from . import dsp
from .config import load_config, read_toml
from .errors import AudioError
from .recipe import FILTER_FIELDS, FILTER_TYPES, _check_table, impulse_source_id
from .sources import Registry, sha256_file, upsert_entry

FIELDS = ("seed", "length", "rt60", "density", "filter")
PEAK_DB = -1.0
FADE_MS = 5.0


def _number(spec: dict, name: str, where: str, lo: float, hi: float = float("inf")) -> float:
    value = spec.get(name)
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not lo < value <= hi:
        raise AudioError(f"{where}: {name}: must be a number above {lo}" + (f" and at most {hi}" if hi != float("inf") else ""))
    return value


def _check(spec: dict, where: str):
    for name in spec:
        if name not in FIELDS:
            raise AudioError(f"{where}: unknown field '{name}'")
    for name in ("seed", "length", "rt60"):
        if name not in spec:
            raise AudioError(f"{where}: missing '{name}'")
    seed = spec["seed"]
    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
        raise AudioError(f"{where}: seed: must be a whole number, 0 or more")
    _number(spec, "length", where, 0)
    _number(spec, "rt60", where, 0)
    if "density" in spec:
        _number(spec, "density", where, 0, 1)
    filters = spec.get("filter", [])
    if not isinstance(filters, list):
        raise AudioError(f"{where}: filter: must be a list of tables")
    for i, table in enumerate(filters, start=1):
        _check_table(table, FILTER_FIELDS, FILTER_TYPES, f"{where}: filter {i}", "type")
        if any(isinstance(v, list) for v in table.values()):
            raise AudioError(f"{where}: filter {i}: an impulse takes no ranges")


def render_impulse(spec: dict, name: str, sr: int) -> np.ndarray:
    where = f"impulse {name}"
    _check(spec, where)
    n = dsp.samples(spec["length"], sr)
    rng = np.random.default_rng([spec["seed"]])
    x = rng.standard_normal(n)
    density = spec.get("density", 1.0)
    if density < 1.0:
        x *= rng.random(n) < density
    t = np.arange(n) / sr
    x *= 10 ** (-3.0 * t / spec["rt60"])
    for table in spec.get("filter", []):
        x = dsp.apply_filter(x, sr, table)
    x = dsp.fade_out(x, sr, FADE_MS)
    peak = np.max(np.abs(x))
    if peak == 0:
        raise AudioError(f"{where}: renders to silence")
    return x * (dsp.db2lin(PEAK_DB) / peak)


def _write_if_changed(path: Path, x: np.ndarray, sr: int) -> bool:
    with tempfile.TemporaryDirectory() as folder:
        fresh = Path(folder) / path.name
        sf.write(fresh, x, sr, subtype="PCM_24", format="FLAC")
        data = fresh.read_bytes()
    if path.exists() and path.read_bytes() == data:
        return False
    path.write_bytes(data)
    return True


def build_impulses(root: Path, names: list[str] | None = None) -> list[tuple[Path, bool]]:
    """Renders each impulse (all, or those named) and registers it. Returns
    each FLAC's path and whether it or its entry changed."""
    root = Path(root)
    sr = load_config(root).sample_rate
    folder = root / "impulses"
    available = sorted(p.stem for p in folder.glob("*.toml")) if folder.exists() else []
    for name in names or []:
        if name not in available:
            raise AudioError(f"impulse {name}: no recipe at impulses/{name}.toml")
    chosen = names or available
    rendered = [(name, render_impulse(read_toml(folder / f"{name}.toml", f"impulse {name}"), name, sr)) for name in chosen]
    existing = Registry.load(root).entries
    results = []
    for name, x in rendered:
        path = folder / f"{name}.flac"
        changed = _write_if_changed(path, x, sr)
        id = impulse_source_id(name)
        entry = {
            "id": id,
            "file": f"impulses/{name}.flac",
            "licence": "own",
            "author": "generated: yomi-audio impulse build",
            "url": "local",
            "original": f"impulses/{name}.toml",
            "sha256": sha256_file(path),
            "retrieved": existing.get(id, {}).get("retrieved") if not changed and id in existing
            else datetime.date.today().isoformat(),
            "notes": "decaying filtered noise, rendered from its recipe",
        }
        changed = upsert_entry(root, entry) or changed
        results.append((path, changed))
    return results
