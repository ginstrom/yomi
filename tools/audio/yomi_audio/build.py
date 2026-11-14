"""`sfx build` and `sfx check`: recipes to banks, and banks against recipes (C6).

Paths, for a project root `<repo>/audio`:

- recipes `audio/sfx/<bank>/<name>.toml`, the cue `<bank>.<name>`;
- the manifest `audio/sfx.manifest.json`;
- the banks `<repo>/public/assets/audio/sfx/<bank>.{opus,mp3,json}`;
- voice files (budget only) `<repo>/public/assets/voice/*.{opus,mp3}`.

**Build.** Each cue's `inputs` hash covers its recipe's text, the SHA-256 of
every source and impulse file it names (and each one's recorded licence and
SHA-256), `audio.toml`, the tool's version and `uv.lock`. Every source of
every recipe is verified on every build, before anything is decided, so an
incremental build refuses a licence or hash that went bad since the last. A cue is *changed* when its hash differs from the manifest's (or it
is new); a bank is *touched* when one of its cues changed, was removed or was
named by `--cue`/`--bank`, or when one of its files is missing or no longer
matches the manifest. Every cue of a touched bank is rendered (rendering is
deterministic, so an unchanged cue renders the same PCM) and checked
(`checks.py`); all failures of a run are reported together and nothing is
written. A touched bank is then laid out (cues in sorted order, variants in
order, each padded to a whole millisecond, `gap_ms` of silence before each
marker and after the last), encoded with ffmpeg to Opus and MP3, and its
Phaser audio-sprite JSON written. The budgets are checked before any file is
written. Untouched banks are left alone, byte for byte.

**Check** writes nothing and never encodes: encoders differ from build to
build, so the encoded files are compared only with the manifest's own record
of their size and SHA-256.
"""
import hashlib
import json
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import soundfile as sf

from . import __version__, checks
from .config import CONFIG_FILE, Config, load_config
from .errors import AudioError
from .recipe import CUE_PATTERN, Recipe, parse_recipe, render_variant, verify_sources
from .sources import Registry, sha256_file

MANIFEST_FILE = "sfx.manifest.json"
MANIFEST_VERSION = 1
FORMATS = ("opus", "mp3")
LOCK_FILE = Path(__file__).resolve().parents[1] / "uv.lock"


def bank_dir(root: Path) -> Path:
    return Path(root).parent / "public" / "assets" / "audio" / "sfx"


def voice_dir(root: Path) -> Path:
    return Path(root).parent / "public" / "assets" / "voice"


class BuildFailed(AudioError):
    """Several problems at once; the message lists one a line."""

    def __init__(self, what: str, lines: list[str]):
        super().__init__(f"{what}: {len(lines)} problem{'s' if len(lines) != 1 else ''}\n  " + "\n  ".join(lines))
        self.lines = lines


@dataclass
class Report:
    rendered: list[str] = field(default_factory=list)  # every cue rendered (those of touched banks)
    changed: list[str] = field(default_factory=list)  # cues whose inputs changed, or new
    removed: list[str] = field(default_factory=list)
    banks: list[str] = field(default_factory=list)  # banks written
    deleted_banks: list[str] = field(default_factory=list)
    measured: list[checks.Measured] = field(default_factory=list)


# Discovery and hashing ----------------------------------------------------------------


def recipe_files(config: Config) -> dict[str, Path]:
    """Every recipe, by cue id, sorted. A folder of `sfx/` that is not a bank
    is an error."""
    folder = config.root / "sfx"
    found = {}
    if not folder.exists():
        return found
    for bank in sorted(p for p in folder.iterdir() if p.is_dir()):
        tomls = sorted(bank.glob("*.toml"))
        if bank.name not in config.banks:
            if tomls:
                raise AudioError(f"sfx/{bank.name}/: '{bank.name}' is not a bank in {CONFIG_FILE} ({', '.join(config.banks)})")
            continue
        for path in tomls:
            cue = f"{bank.name}.{path.stem}"
            if not CUE_PATTERN.match(cue):
                raise AudioError(f"cue '{cue}': must be <bank>.<name>, lower case letters, digits and _")
            found[cue] = path
    return dict(sorted(found.items()))


def _bank_of(cue: str) -> str:
    return cue.split(".", 1)[0]


class Hasher:
    """Inputs hashes, each file read once."""

    def __init__(self, config: Config, registry: Registry):
        self.config = config
        self.registry = registry
        self._files: dict[Path, str | None] = {}
        self.common = {
            "audio_toml": sha256_file(config.root / CONFIG_FILE),
            "tool": f"yomi-audio {__version__}",
            "uv_lock": sha256_file(LOCK_FILE) if LOCK_FILE.exists() else None,
        }

    def _file(self, path: Path) -> str | None:
        if path not in self._files:
            self._files[path] = sha256_file(path) if path.is_file() else None
        return self._files[path]

    def inputs(self, recipe: Recipe) -> str:
        sources = {}
        for id in recipe.source_ids():
            entry = self.registry.entries.get(id)
            sources[id] = (
                {
                    "file": self._file(self.config.root / entry["file"]),
                    "licence": entry["licence"],
                    "sha256": entry["sha256"],
                }
                if entry
                else None
            )
        payload = {"recipe": recipe.text, "sources": sources, **self.common}
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _load_recipes(config: Config, files: dict[str, Path]) -> tuple[dict[str, Recipe], list[str]]:
    recipes, errors = {}, []
    for cue, path in files.items():
        try:
            recipes[cue] = parse_recipe(path.read_text(encoding="utf-8"), cue, config.groups)
        except AudioError as error:
            errors.append(str(error))
    return recipes, errors


def read_manifest(root: Path) -> dict | None:
    path = Path(root) / MANIFEST_FILE
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise AudioError(f"{MANIFEST_FILE}: not valid JSON ({error}); rebuild it with `npm run sounds`") from None
    if data.get("version") != MANIFEST_VERSION:
        raise AudioError(f"{MANIFEST_FILE}: version {data.get('version')!r}, expected {MANIFEST_VERSION}")
    data.setdefault("banks", {})
    data.setdefault("cues", {})
    return data


def manifest_text(manifest: dict) -> str:
    return json.dumps(manifest, indent=2, sort_keys=True) + "\n"


def _folder_bytes(*folders: Path) -> int:
    return sum(p.stat().st_size for folder in folders if folder.exists() for p in folder.rglob("*") if p.is_file())


def _budget(config: Config, name: str) -> int | None:
    value = config.budgets.get(name)
    return int(value) if value is not None else None


def _sources_over_budget(config: Config) -> str | None:
    limit = _budget(config, "sources_bytes")
    used = _folder_bytes(config.root / "sources", config.root / "voices")
    if limit is not None and used > limit:
        return f"budget sources_bytes: audio/sources and audio/voices hold {used:,} bytes, over {limit:,}"
    return None


def _bank_file_problems(bank: str, record: dict, folder: Path) -> list[str]:
    out = []
    for fmt in FORMATS:
        path = folder / f"{bank}.{fmt}"
        if not path.is_file():
            out.append(f"bank {bank}: {path.name} is missing")
        elif path.stat().st_size != record.get(fmt, {}).get("bytes") or sha256_file(path) != record.get(fmt, {}).get("sha256"):
            out.append(f"bank {bank}: {path.name} does not match the manifest's size and SHA-256")
    if not (folder / f"{bank}.json").is_file():
        out.append(f"bank {bank}: {bank}.json is missing")
    return out


# Build ---------------------------------------------------------------------------------


def _encode(wav: Path, out: Path, fmt: str, settings: dict) -> None:
    common = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-ar", "48000",
              "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact"]
    if fmt == "opus":
        codec = ["-c:a", "libopus", "-b:a", f"{settings.get('opus_kbps', 64)}k", "-vbr", "on", "-application", "audio"]
    else:
        codec = ["-c:a", "libmp3lame", "-q:a", str(settings.get("mp3_q", 5))]
    result = subprocess.run([*common, *codec, str(out)], capture_output=True, text=True)
    if result.returncode != 0:
        raise AudioError(f"ffmpeg could not encode {out.name}: {' '.join(result.stderr.split())}")


def expected_sprite(bank: str, durations: list[tuple[str, int]], gap_ms: int) -> tuple[dict, int]:
    """The bank's Phaser audio-sprite JSON for its markers and their
    durations (ms) in order, and the bank's length in ms: `gap_ms` before
    each marker and after the last."""
    spritemap, at_ms = {}, 0
    for marker, duration in durations:
        at_ms += gap_ms
        spritemap[marker] = {"start": at_ms / 1000, "end": (at_ms + duration) / 1000, "loop": False}
        at_ms += duration
    return {"resources": [f"{bank}.{fmt}" for fmt in FORMATS], "spritemap": spritemap}, at_ms + gap_ms


def _layout(cues: list[str], pcm: dict[str, list[np.ndarray]], sr: int, gap_ms: int):
    """The bank's samples (`gap_ms` of silence before each variant and after
    the last, each variant padded to a whole ms) and each cue's durations in ms."""
    per_ms = sr / 1000
    gap = np.zeros(int(round(gap_ms * per_ms)))
    pieces, durations = [], {}
    for cue in cues:
        durations[cue] = []
        for x in pcm[cue]:
            duration = int(np.ceil(len(x) / per_ms))
            slot = np.zeros(int(round(duration * per_ms)))
            slot[: len(x)] = x
            pieces += [gap, slot]
            durations[cue].append(duration)
    pieces.append(gap)
    return np.concatenate(pieces), durations


def build(root: Path, bank: str | None = None, cue: str | None = None, echo=print) -> Report:
    root = Path(root)
    config = load_config(root)
    registry = Registry.load(root)
    sr = config.sample_rate
    gap_ms = int(config.gap_ms)
    files = recipe_files(config)
    if bank is not None and bank not in config.banks:
        raise AudioError(f"--bank {bank}: not a bank in {CONFIG_FILE} ({', '.join(config.banks)})")
    if cue is not None and cue not in files:
        raise AudioError(f"--cue {cue}: no recipe at sfx/{cue.replace('.', '/', 1)}.toml")
    recipes, errors = _load_recipes(config, files)
    for c, recipe in recipes.items():
        try:
            verify_sources(recipe, registry)
        except AudioError as error:
            errors.append(str(error))
    if errors:
        raise BuildFailed("sfx build", errors)

    old = read_manifest(root) or {"version": MANIFEST_VERSION, "banks": {}, "cues": {}}
    out_dir = bank_dir(root)
    hasher = Hasher(config, registry)
    inputs = {c: hasher.inputs(r) for c, r in recipes.items()}
    report = Report()
    report.changed = [c for c in recipes if old["cues"].get(c, {}).get("inputs") != inputs[c]]
    report.removed = sorted(c for c in old["cues"] if c not in recipes)
    touched = {_bank_of(c) for c in report.changed + report.removed}
    touched |= {_bank_of(cue)} if cue else set()
    touched |= {bank} if bank else set()
    for name, record in old["banks"].items():
        if _bank_file_problems(name, record, out_dir):
            touched.add(name)
    banks_now = {_bank_of(c) for c in recipes}
    touched |= banks_now - set(old["banks"])

    problem = _sources_over_budget(config)
    if problem:
        raise BuildFailed("sfx build", [problem])

    # Render and check every cue of a touched bank.
    failures: list[str] = []
    pcm: dict[str, list[np.ndarray]] = {}
    for c, recipe in recipes.items():
        if _bank_of(c) not in touched:
            continue
        try:
            variants = [render_variant(recipe, k, registry, sr) for k in range(recipe.variants)]
        except AudioError as error:
            failures.append(str(error))
            continue
        for k, x in enumerate(variants):
            m = checks.measure_variant(c, k, x, sr, recipe.group, recipe.max_ms)
            report.measured.append(m)
            failures += checks.failures(m, recipe.group, recipe.max_ms)
        failures += checks.correlation_failures(c, variants)
        pcm[c] = variants
        report.rendered.append(c)
    if failures:
        raise BuildFailed("sfx build", failures)

    if shutil.which("ffmpeg") is None:
        raise AudioError("sfx build: ffmpeg is not on the PATH")
    manifest = {
        "version": MANIFEST_VERSION,
        "tool": f"yomi-audio {__version__}",
        "banks": {b: r for b, r in old["banks"].items() if b in banks_now and b not in touched},
        "cues": {c: e for c, e in old["cues"].items() if c in recipes and _bank_of(c) not in touched},
    }
    with tempfile.TemporaryDirectory() as scratch:
        scratch = Path(scratch)
        for name in sorted(touched & banks_now):
            cues = [c for c in recipes if _bank_of(c) == name]
            samples, durations = _layout(cues, pcm, sr, gap_ms)
            sprite, total_ms = expected_sprite(
                name, [(f"{c}#{k}", d) for c in cues for k, d in enumerate(durations[c])], gap_ms
            )
            wav = scratch / f"{name}.wav"
            sf.write(wav, samples.astype(np.float32), sr, subtype="FLOAT")
            record = {"durationMs": total_ms}
            for fmt in FORMATS:
                _encode(wav, scratch / f"{name}.{fmt}", fmt, config.encode.get("sfx", {}))
                path = scratch / f"{name}.{fmt}"
                record[fmt] = {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
            wav.unlink()
            (scratch / f"{name}.json").write_text(json.dumps(sprite, indent=2) + "\n", encoding="utf-8")
            manifest["banks"][name] = record
            for c in cues:
                manifest["cues"][c] = {
                    "bank": name,
                    "markers": [f"{c}#{k}" for k in range(len(pcm[c]))],
                    "durationsMs": durations[c],
                    "inputs": inputs[c],
                }
        problem = _sfx_over_budget(config, manifest)
        if problem:
            raise BuildFailed("sfx build", [problem])

        # Everything checked: write.
        out_dir.mkdir(parents=True, exist_ok=True)
        for produced in sorted(scratch.iterdir()):
            shutil.copyfile(produced, out_dir / produced.name)
    for name in sorted(set(old["banks"]) - banks_now):
        for suffix in (*FORMATS, "json"):
            (out_dir / f"{name}.{suffix}").unlink(missing_ok=True)
        report.deleted_banks.append(name)
    text = manifest_text(manifest)
    path = root / MANIFEST_FILE
    if not path.exists() or path.read_text(encoding="utf-8") != text:
        path.write_text(text, encoding="utf-8")
    report.banks = sorted(touched & banks_now)
    _summarise(report, config, manifest, echo)
    return report


def _sfx_over_budget(config: Config, manifest: dict) -> str | None:
    limit = _budget(config, "sfx_bytes_per_format")
    if limit is None:
        return None
    for fmt in FORMATS:
        used = sum(record[fmt]["bytes"] for record in manifest["banks"].values())
        if used > limit:
            return f"budget sfx_bytes_per_format: the banks' .{fmt} files come to {used:,} bytes, over {limit:,}"
    return None


def _summarise(report: Report, config: Config, manifest: dict, echo) -> None:
    if not report.rendered and not report.deleted_banks:
        echo(f"sfx build: nothing changed ({len(manifest['cues'])} cues up to date)")
        return
    echo(
        f"sfx build: rendered {len(report.rendered)} cues ({len(report.changed)} changed, "
        f"{len(report.removed)} removed); wrote {', '.join(report.banks) or 'no bank'}"
        + (f"; deleted {', '.join(report.deleted_banks)}" if report.deleted_banks else "")
    )
    by_group: dict[str, list[checks.Measured]] = {}
    for m in report.measured:
        by_group.setdefault(m.group, []).append(m)
    for name, rows in sorted(by_group.items()):
        group = config.groups[name]
        levels = [m.loudness for m in rows]
        echo(
            f"  {name:<9} {len(rows):>3} variants  {min(levels):6.1f} to {max(levels):6.1f} "
            f"{checks.LABEL[group.measure]} (target {group.target:g} ±{group.tolerance:g})  "
            f"peak ≤ {max(m.true_peak for m in rows):5.1f} dBTP (ceiling {group.peak:g})"
        )
    limited: dict[str, list[checks.Measured]] = {}
    for m in report.measured:
        if m.peak_limited:
            limited.setdefault(m.cue, []).append(m)
    for cue, rows in limited.items():
        group = config.groups[rows[0].group]
        echo(
            f"  {cue} peak-limited (under its target by the {group.peak:g} dBTP ceiling): "
            + ", ".join(f"#{m.k} {m.loudness:.1f}" for m in rows)
            + f" {checks.LABEL[group.measure]} (target {group.target:g})"
        )
    for fmt in FORMATS:
        used = sum(record[fmt]["bytes"] for record in manifest["banks"].values())
        echo(f"  .{fmt}: {used:,} bytes in all banks (budget {_budget(config, 'sfx_bytes_per_format') or 0:,})")


# Check ---------------------------------------------------------------------------------


def check(root: Path, echo=print) -> list[str]:
    """Every way the built files disagree with the recipes, or a budget is
    exceeded; [] when all is well. Writes nothing."""
    root = Path(root)
    config = load_config(root)
    registry = Registry.load(root)
    files = recipe_files(config)
    recipes, found = _load_recipes(config, files)
    manifest = read_manifest(root) or {"banks": {}, "cues": {}}
    hasher = Hasher(config, registry)
    out_dir = bank_dir(root)

    for c in files:
        if c not in manifest["cues"]:
            found.append(f"{c}: has no manifest entry (run npm run sounds)")
    for c in manifest["cues"]:
        if c not in files:
            found.append(f"{c}: in the manifest but has no recipe (run npm run sounds)")
    for c, recipe in recipes.items():
        for id in recipe.source_ids():
            try:
                registry.source(id, c)
            except AudioError as error:
                found.append(str(error))
        entry = manifest["cues"].get(c)
        if entry is not None and entry.get("inputs") != hasher.inputs(recipe):
            found.append(f"{c}: its recipe, sources or settings changed since the last build (run npm run sounds)")

    for name, record in sorted(manifest["banks"].items()):
        problems = _bank_file_problems(name, record, out_dir)
        found += problems
        if any(p.endswith(f"{name}.json is missing") for p in problems):
            continue
        cues = sorted(c for c, e in manifest["cues"].items() if e.get("bank") == name)
        try:
            pairs = [(m, d) for c in cues for m, d in zip(manifest["cues"][c]["markers"], manifest["cues"][c]["durationsMs"], strict=True)]
            expected, total_ms = expected_sprite(name, pairs, int(config.gap_ms))
            sprite = json.loads((out_dir / f"{name}.json").read_text(encoding="utf-8"))
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            expected, sprite, total_ms = None, {}, None
        if expected is None or sprite != expected:
            found.append(f"bank {name}: {name}.json does not match the manifest's markers and durations")
        elif total_ms != record.get("durationMs"):
            found.append(f"bank {name}: the manifest's durationMs disagrees with its markers")
    for c, entry in manifest["cues"].items():
        if entry.get("bank") not in manifest["banks"]:
            found.append(f"{c}: its bank {entry.get('bank')!r} is not in the manifest")

    for problem in (_sfx_over_budget(config, manifest), _sources_over_budget(config)):
        if problem:
            found.append(problem)
    limit = _budget(config, "voice_bytes_per_format")
    if limit is not None:
        for fmt in FORMATS:
            used = sum(p.stat().st_size for p in voice_dir(root).glob(f"*.{fmt}")) if voice_dir(root).exists() else 0
            if used > limit:
                found.append(f"budget voice_bytes_per_format: the voice .{fmt} files come to {used:,} bytes, over {limit:,}")

    if not found:
        echo(f"sfx check: {len(manifest['cues'])} cues and {len(manifest['banks'])} banks up to date, within budget")
    return found
