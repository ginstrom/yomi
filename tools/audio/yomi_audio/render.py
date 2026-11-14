"""`voice render`: the shipped narration lines (design §5.8.5).

Reads `<root>/narration.jobs.json` (written by `npm run narration:export`),
compares each job's hash with `<root>/voice.manifest.json` and renders only
the lines whose hash differs, that have no entry or whose files are missing.
A line is rendered by the engine its voice table names (Chatterbox clones the
voice's clip for the emotion, else its neutral clip; Qwen3 is told the
emotion), put through audio.toml's [voice] chain, encoded as
`public/assets/voice/<line>.opus` (mono, voip) and `.mp3` (mono VBR), and
recorded in the manifest. Files of lines no longer in the jobs are deleted
with their entries. Nothing is written when the job file's adapter version
differs from `voices.toml`'s or the adapter's.
"""
import json
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from . import loudness
from .build import manifest_text, voice_dir
from .config import Config, read_toml
from .errors import AudioError
from .tts.base import ADAPTER_VERSION, RenderJob, qwen_instruction
from .voice import postprocess, write_wav

JOBS_FILE = "narration.jobs.json"
MANIFEST_FILE = "voice.manifest.json"
VOICES_FILE = "voices.toml"
FORMATS = ("opus", "mp3")
PEAK_SLACK_DB = 0.01      # true-peak measurement noise allowed over the ceiling


@dataclass
class RenderReport:
    rendered: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    deleted: list[str] = field(default_factory=list)


def _read_json(path: Path, what: str) -> dict:
    if not path.exists():
        raise AudioError(f"{what}: not found at {path} (run `npm run narration:export`)" if what == JOBS_FILE else f"{what}: not found at {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise AudioError(f"{what}: invalid JSON: {error}") from None


def _reference(root: Path, job: dict) -> Path | None:
    """The clip a Chatterbox voice clones for the job's emotion: the emotion's
    own clip, else the voice's neutral one."""
    table = job["voiceTable"]
    if table["engine"].startswith("qwen3"):
        return None
    clips = table.get("clips") or {}
    relative = clips.get(job["emotion"]) or clips.get("neutral")
    if relative is None:
        raise AudioError(f"line {job['line']}: voice {job['voice']} has no clip for {job['emotion']} and no neutral clip")
    path = root / relative
    if not path.exists():
        raise AudioError(f"line {job['line']}: reference clip {relative} is missing")
    return path


def _render_job(root: Path, job: dict) -> RenderJob:
    table = job["voiceTable"]
    instruction = qwen_instruction(job["emotion"], job["intensity"]) if table["engine"].startswith("qwen3") else None
    return RenderJob(
        text=job["spoken"], emotion=job["emotion"], intensity=job["intensity"], seed=job["seed"],
        voice=table, reference_clip=_reference(root, job), instruction=instruction,
    )


def _encode(wav: Path, out: Path, fmt: str, settings: dict) -> None:
    common = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", str(wav), "-ac", "1", "-ar", "48000",
              "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact"]
    if fmt == "opus":
        codec = ["-c:a", "libopus", "-b:a", f"{settings.get('opus_kbps', 32)}k", "-vbr", "on", "-application", "voip"]
    else:
        codec = ["-c:a", "libmp3lame", "-q:a", str(settings.get("mp3_q", 7))]
    result = subprocess.run([*common, *codec, str(out)], capture_output=True, text=True)
    if result.returncode != 0:
        raise AudioError(f"ffmpeg could not encode {out.name}: {' '.join(result.stderr.split())}")


def _needs_render(job: dict, manifest: dict, folder: Path) -> bool:
    entry = manifest["lines"].get(job["line"])
    files = all((folder / f"{job['line']}.{fmt}").is_file() for fmt in FORMATS)
    return entry is None or entry.get("hash") != job["hash"] or not files


def render_lines(config: Config, engines: dict, echo=print) -> RenderReport:
    root = Path(config.root)
    jobs_file = _read_json(root / JOBS_FILE, JOBS_FILE)
    registry = read_toml(root / VOICES_FILE, VOICES_FILE)
    for what, version in (("voices.toml", registry.get("adapter_version")), ("the adapter", ADAPTER_VERSION)):
        if jobs_file.get("adapter_version") != version:
            raise AudioError(
                f"{JOBS_FILE}: adapter_version {jobs_file.get('adapter_version')} differs from {what}'s {version}; "
                "run `npm run narration:export` again"
            )
    jobs = jobs_file["jobs"]
    manifest_path = root / MANIFEST_FILE
    manifest = _read_json(manifest_path, MANIFEST_FILE) if manifest_path.exists() else {"version": 1, "lines": {}}
    manifest.setdefault("lines", {})
    folder = voice_dir(root)
    folder.mkdir(parents=True, exist_ok=True)
    sr = config.sample_rate
    report = RenderReport()
    ceiling = config.voice["peak_dbtp"]

    for job in jobs:
        line = job["line"]
        if not _needs_render(job, manifest, folder):
            report.skipped.append(line)
            continue
        engine_name = job["voiceTable"]["engine"]
        if engine_name not in engines:
            raise AudioError(f"line {line}: no engine '{engine_name}'")
        try:
            engine = engines[engine_name]
            pcm, engine_sr = engine.render(_render_job(root, job))
            clip = postprocess(pcm, engine_sr, config, f"line {line}")
            peak = loudness.true_peak_db(clip)
            if peak > ceiling + PEAK_SLACK_DB:
                raise AudioError(f"line {line}: true peak {peak:.2f} dBTP is over {ceiling}")
            with tempfile.TemporaryDirectory() as tmp:
                wav = write_wav(Path(tmp) / f"{line}.wav", clip, sr)
                for fmt in FORMATS:
                    _encode(wav, folder / f"{line}.{fmt}", fmt, config.encode.get("voice", {}))
        except AudioError as error:
            raise AudioError(str(error) if str(error).startswith(f"line {line}") else f"line {line}: {error}") from None
        table = job["voiceTable"]
        manifest["lines"][line] = {
            "hash": job["hash"],
            "durationMs": round(len(clip) / sr * 1000),
            "voice": job["voice"],
            "engine": f"{engine_name}@{table['revision']}",
        }
        report.rendered.append(line)
        echo(f"rendered {line}: {len(clip) / sr:.2f} s, {loudness.integrated(clip, sr):.1f} LUFS-I, {peak:.2f} dBTP")

    wanted = {job["line"] for job in jobs}
    for path in sorted(folder.glob("*")):
        if path.suffix[1:] in FORMATS and path.stem not in wanted:
            path.unlink()
            if path.stem not in report.deleted:
                report.deleted.append(path.stem)
    for line in sorted(set(manifest["lines"]) - wanted):
        del manifest["lines"][line]
        if line not in report.deleted:
            report.deleted.append(line)

    limit = config.budgets.get("voice_bytes_per_format")
    if limit is not None:
        for fmt in FORMATS:
            used = sum(p.stat().st_size for p in folder.glob(f"*.{fmt}"))
            if used > int(limit):
                raise AudioError(f"budget voice_bytes_per_format: public/assets/voice/*.{fmt} hold {used:,} bytes, over {int(limit):,}")

    text = manifest_text(manifest)
    if not manifest_path.exists() or manifest_path.read_text(encoding="utf-8") != text:
        manifest_path.write_text(text, encoding="utf-8")
    echo(f"rendered {len(report.rendered)}, skipped {len(report.skipped)}, deleted {len(report.deleted)}")
    return report
