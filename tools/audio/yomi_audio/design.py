"""`voice design <voice>`: emotion reference-clip candidates for a voice of
`voices.toml` (design §5.8.3), for the author to pick by ear.

The voice's neutral clip is the reference (`--neutral`, else the clip its
`[<voice>.clips]` names, by default `voices/<voice>/neutral.flac`). For each
emotion asked (default: every one the voice declares but neutral), Qwen3-TTS
VoiceDesign reads `[<voice>.design].reference_text` from its `description`
with the emotion's instruction appended, seeds `seed` to `seed + N - 1`. Each
candidate goes through the `[voice]` chain and is measured against the
reference by speaker similarity; those below `THRESHOLD` (0.75) are another
voice and are discarded (logged, never written). The rest are written as
`<out>/<emotion>_<k>.wav`, beside `neutral.wav` (the reference, processed),
`design.json` (every candidate's seed, similarity, loudness and length) and
`review.md` (the same as tables, and how to answer).

A run for some emotions replaces those emotions' candidates and keeps the
others, unless the reference changed, which drops them all.
"""
import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path

import soundfile as sf

from . import loudness
from .config import Config, read_toml
from .errors import AudioError
from .tts.base import EMOTION_MAP, emotion_spec
from .tts.similarity import THRESHOLD, cosine
from .voice import CANDIDATES, postprocess, write_wav

VOICES_FILE = "voices.toml"
DESIGN_FIELDS = ("description", "reference_text", "seed")
RECORD = "design.json"
REVIEW = "review.md"
MORE_SEEDS = 8


def read_voice(root: Path, voice: str) -> dict:
    """The voice's table from `voices.toml`, its `design` table checked."""
    data = read_toml(Path(root) / VOICES_FILE, VOICES_FILE)
    voices = {k: v for k, v in data.items() if isinstance(v, dict)}
    if voice not in voices:
        raise AudioError(f"{VOICES_FILE}: unknown voice '{voice}' (expected one of {', '.join(voices) or 'none'})")
    table = voices[voice]
    design = table.get("design")
    if not isinstance(design, dict):
        raise AudioError(f"{VOICES_FILE}: {voice}.design is missing")
    for name in DESIGN_FIELDS:
        if name not in design:
            raise AudioError(f"{VOICES_FILE}: {voice}.design.{name} is missing")
    if not isinstance(design["seed"], int) or isinstance(design["seed"], bool):
        raise AudioError(f"{VOICES_FILE}: {voice}.design.seed must be an integer")
    if not isinstance(table.get("emotions"), list):
        raise AudioError(f"{VOICES_FILE}: {voice}.emotions is missing")
    return table


@dataclass
class Candidate:
    k: int
    seed: int
    similarity: float
    lufs: float
    seconds: float
    offered: bool


@dataclass
class DesignRun:
    voice: str
    neutral: Path
    emotions: dict[str, list[Candidate]]


def _neutral(root: Path, voice: str, table: dict, given: Path | None) -> Path:
    if given is not None:
        path = Path(given)
        if not path.exists():
            raise AudioError(f"voice {voice}: the neutral reference {path} does not exist")
        return path
    relative = (table.get("clips") or {}).get("neutral") or f"voices/{voice}/neutral.flac"
    path = Path(root) / relative
    if not path.exists():
        raise AudioError(
            f"voice {voice}: needs a neutral reference: {relative} does not exist (pass --neutral <wav>)"
        )
    return path


def _emotions(voice: str, table: dict, asked: list[str] | None) -> list[str]:
    declared = table["emotions"]
    if asked is None:
        return [e for e in declared if e != "neutral"]
    for emotion in asked:
        if emotion == "neutral":
            raise AudioError(f"voice {voice}: neutral is the reference, not a clip designed here")
        if emotion not in EMOTION_MAP or emotion not in declared:
            raise AudioError(f"voice {voice}: '{emotion}' is not an emotion it declares ({', '.join(declared)})")
    return list(dict.fromkeys(asked))


def _sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _earlier(out: Path, voice: str, neutral_sha: str) -> dict:
    """The emotions an earlier run designed against the same reference; with
    another reference, none (and their candidates are deleted)."""
    record = out / RECORD
    if record.exists():
        data = json.loads(record.read_text(encoding="utf-8"))
        if data.get("voice") == voice and data.get("neutral_sha256") == neutral_sha:
            return data.get("emotions", {})
    for emotion in EMOTION_MAP:
        _clear(out, emotion)
    return {}


def _clear(out: Path, emotion: str) -> None:
    """Deletes an emotion's candidates (`<emotion>_<k>.wav`) and nothing else."""
    for old in out.glob(f"{emotion}_*.wav"):
        if old.stem[len(emotion) + 1:].isdigit():
            old.unlink()


def candidate_name(emotion: str, k: int) -> str:
    return f"{emotion}_{k}.wav"


def review_sheet(voice: str, table: dict, neutral: Path, emotions: dict[str, list[dict]]) -> str:
    design = table["design"]
    lines = [
        f"# Voice design: {voice}",
        "",
        f"Description: {design['description']}",
        "",
        f"Read by every candidate: \"{design['reference_text']}\"",
        "",
        f"Neutral reference: `neutral.wav` (from `{neutral}`). Every candidate below was measured against it",
        f"by speaker similarity (cosine of Chatterbox's voice-encoder embeddings); those under {THRESHOLD:.2f}",
        "are another voice and were discarded, so no file is offered for them.",
        "",
        "**How to answer:** for each emotion, listen to `neutral.wav`, then to each candidate, and name the one",
        "that keeps the voice and carries the emotion best (e.g. `grave_2`), or \"none, redo with seed …\"",
        "(a first seed to try instead).",
        "",
    ]
    for emotion, candidates in emotions.items():
        lines += [f"## {emotion}", "", f"Instruction: \"{EMOTION_MAP[emotion].instruction}\"", ""]
        lines += ["| Candidate | File | Seed | Similarity | LUFS-I | Length (s) |", "| --- | --- | --- | --- | --- | --- |"]
        for c in candidates:
            file = f"`{candidate_name(emotion, c['k'])}`" if c["offered"] else f"discarded (below {THRESHOLD:.2f})"
            lines.append(
                f"| {c['k']} | {file} | {c['seed']} | {c['similarity']:.3f} | {c['lufs']:.1f} | {c['seconds']:.2f} |"
            )
        if not any(c["offered"] for c in candidates):
            lines += ["", f"No candidate reaches {THRESHOLD:.2f}: try more seeds (`--candidates {MORE_SEEDS}`)."]
        lines.append("")
    return "\n".join(lines)


def design_emotions(
    config: Config,
    voice: str,
    engine,
    encoder,
    out: Path | None = None,
    neutral: Path | None = None,
    emotions: list[str] | None = None,
    candidates: int = CANDIDATES,
    echo=print,
) -> DesignRun:
    if candidates < 1:
        raise AudioError("--candidates must be at least 1")
    root = Path(config.root)
    table = read_voice(root, voice)
    design = table["design"]
    reference_path = _neutral(root, voice, table, neutral)
    wanted = _emotions(voice, table, emotions)
    for emotion in wanted:
        emotion_spec(emotion)
    out = Path(out) if out is not None else root / ".audition" / f"voice-{voice}"
    out.mkdir(parents=True, exist_ok=True)
    sr = config.sample_rate

    neutral_sha = _sha256(reference_path)
    pcm, neutral_sr = sf.read(reference_path, dtype="float32", always_2d=True)
    reference = postprocess(pcm.mean(axis=1), neutral_sr, config, f"voice {voice} neutral reference")
    recorded = _earlier(out, voice, neutral_sha)
    write_wav(out / "neutral.wav", reference, sr)
    embedding = encoder.embed(reference, sr)
    echo(f"voice {voice}: neutral reference {reference_path} ({len(reference) / sr:.1f} s)")

    result = DesignRun(voice, reference_path, {})
    for emotion in wanted:
        _clear(out, emotion)
        instruction = emotion_spec(emotion).instruction
        found = []
        for k in range(candidates):
            seed = design["seed"] + k
            raw, engine_sr = engine.design(design["description"], design["reference_text"], instruction, seed)
            clip = postprocess(raw, engine_sr, config, f"voice {voice} {emotion} candidate {k}")
            similarity = round(cosine(embedding, encoder.embed(clip, sr)), 4)
            offered = similarity >= THRESHOLD
            candidate = Candidate(
                k, seed, similarity, round(loudness.integrated(clip, sr), 2), round(len(clip) / sr, 2), offered
            )
            found.append(candidate)
            if offered:
                write_wav(out / candidate_name(emotion, k), clip, sr)
            echo(
                f"voice {voice} {emotion:<10} {k}  seed {seed:<4} similarity {similarity:.3f}  "
                f"{candidate.lufs:6.1f} LUFS-I  {candidate.seconds:5.2f} s"
                + ("" if offered else f"  discarded (below {THRESHOLD:.2f})")
            )
        if not any(c.offered for c in found):
            echo(f"voice {voice} {emotion}: no candidate reaches {THRESHOLD:.2f}: try more seeds (--candidates {MORE_SEEDS})")
        result.emotions[emotion] = found
        recorded[emotion] = [asdict(c) for c in found]

    fingerprint = engine.fingerprint() if hasattr(engine, "fingerprint") else {}
    record = {
        "voice": voice,
        "neutral": str(reference_path),
        "neutral_sha256": neutral_sha,
        "description": design["description"],
        "reference_text": design["reference_text"],
        "threshold": THRESHOLD,
        "engine": fingerprint,
        "emotions": recorded,
    }
    (out / RECORD).write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    (out / REVIEW).write_text(review_sheet(voice, table, reference_path, recorded), encoding="utf-8")
    echo(f"wrote {out / REVIEW}")
    return result
