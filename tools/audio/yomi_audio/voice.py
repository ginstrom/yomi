"""Narration: designing voices and the listening test (design §5.8.3, §5.8.6).

`design_voice` designs one of the bake-off's narrators: Qwen3-TTS VoiceDesign
reads the narrator's `reference_text` from its description with seeds `seed`
to `seed + N - 1`, which are the neutral candidates; candidate 0 is the
neutral clip. For each other emotion it reads the same text, from the same
description and seeds, with the emotion's instruction appended; each
candidate's speaker similarity to the neutral clip is measured, those below
0.75 are discarded and the most similar is kept (or, with none above, the
best, flagged). `voice design <voice>` (design.py) designs candidates for a
voice of `voices.toml` for the author to pick instead.

`voice bakeoff` designs narrators A and B (unless `bakeoff/designed/` holds
them), renders the eight lines in four configurations (32 clips), shuffles
their labels with a fixed seed and writes the blind clips, `key.json`,
`score.md`, `neutral_candidates/` and `designed/` into `<root>/bakeoff/`.

Every clip written, designed or rendered, goes through `postprocess`
(audio.toml's [voice]): resampled to the project's rate, high-passed,
silence trimmed with margins, normalised to LUFS-I with a true-peak ceiling.
"""
import hashlib
import json
import random
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d
from scipy.signal import resample_poly

from . import dsp, loudness
from .config import Config
from .errors import AudioError
from .tts.base import ADAPTER_VERSION, RenderJob, emotion_spec, qwen_instruction
from .tts.models import PINS
from .tts.similarity import THRESHOLD, cosine

# A phonetically rich passage of about nine seconds, read for every emotion.
REFERENCE_TEXT = (
    "The old road winds north past the quiet village and over the bridge. "
    "Judge for yourself whether the thick smoke rising there means a hearth, or a warning."
)


@dataclass(frozen=True)
class Narrator:
    id: str
    description: str
    reference_text: str = REFERENCE_TEXT
    seed: int = 7


NARRATORS: dict[str, Narrator] = {
    "A": Narrator(
        "A",
        "A weathered storyteller in his fifties: low, warm, slightly gravelled, unhurried; "
        "neutral British accent; close and dry, no room.",
    ),
    "B": Narrator(
        "B",
        "A woman in her forties: low, resonant, measured, a little husky; neutral British accent; close and dry.",
    ),
}


@dataclass(frozen=True)
class Configuration:
    id: str
    engine: str
    clip: str | None                # "emotion": the line's emotion clip; "neutral": the neutral clip
    preset: str | None = None       # qwen3_custom's speaker


# (c)'s preset: of the nine CustomVoice speakers, the English-native male
# voices are Ryan ("dynamic, strong rhythmic drive") and Aiden ("sunny
# American"); Uncle_Fu ("seasoned, low, mellow") is nearer A's timbre but
# Chinese-native. Ryan is taken as the nearest that reads English natively.
CONFIGURATIONS: dict[str, Configuration] = {
    "a": Configuration("a", "chatterbox", "emotion"),
    "b": Configuration("b", "chatterbox_turbo", "neutral"),
    "c": Configuration("c", "qwen3_custom", None, preset="Ryan"),
}

# The four runs: configuration and narrator ("d" is configuration a with narrator B).
RUNS: tuple[tuple[str, str], ...] = (("a", "A"), ("b", "A"), ("c", "A"), ("a", "B"))

BAKEOFF_LINES: tuple[tuple[str, str], ...] = (
    ("Each day the blight creeps a little further from the east, and each day the land remembers less of what it was.", "neutral"),
    ("Rest here a while. The fire is small, but it is ours, and it will see us through the night.", "warm"),
    ("Three were lost at the ford. Their names are written now in the guild hall's book, and nowhere else.", "grave"),
    ("Something moves beyond the ridge. Too many feet, too quiet, and coming this way.", "tense"),
    ("The Horror falls, and for the first time in a hundred days the wind from the east smells of rain.", "triumphant"),
    ("The watchtower stood for a season. Now only its stones remember the hands that raised them.", "sad"),
    ("Listen. Under the wind... the Source is breathing.", "whisper"),
    ("Who will hold the encampment when the hobgoblins come down past the Salamander Pool, and the kobolds crawl from their warrens?", "neutral"),
)
SIGH_LINES = (3, 6, 7)          # configuration b's lines that open with [sigh]
LABEL_SEED = 20261114           # the blind labels' shuffle
CANDIDATES = 4


def design_emotions() -> list[str]:
    """The emotions the bake-off's lines need, in first-use order."""
    return list(dict.fromkeys(emotion for _, emotion in BAKEOFF_LINES))


# Post-processing -------------------------------------------------------------------


def _resample(x: np.ndarray, sr: int, to: int) -> np.ndarray:
    if sr == to:
        return np.asarray(x, dtype=np.float64)
    ratio = Fraction(to, sr)
    return resample_poly(np.asarray(x, dtype=np.float64), ratio.numerator, ratio.denominator)


def _trim(x: np.ndarray, sr: int, threshold_db: float, before_ms: float, after_ms: float) -> np.ndarray:
    """Cuts silence (below `threshold_db` dBFS, held over 5 ms) at both ends,
    keeping `before_ms` before the first sound and `after_ms` after the last."""
    envelope = maximum_filter1d(np.abs(x), size=max(1, dsp.samples(5, sr)))
    loud = np.nonzero(envelope >= dsp.db2lin(threshold_db))[0]
    if not len(loud):
        return x[:0]
    start = max(0, loud[0] - dsp.samples(before_ms, sr))
    end = min(len(x), loud[-1] + 1 + dsp.samples(after_ms, sr))
    out = x[start:end]
    # A margin the source did not have is padded with silence.
    pad_before = dsp.samples(before_ms, sr) - (loud[0] - start)
    pad_after = dsp.samples(after_ms, sr) - (end - loud[-1] - 1)
    return np.concatenate([np.zeros(max(0, pad_before)), out, np.zeros(max(0, pad_after))])


def postprocess(pcm: np.ndarray, sr: int, config: Config, what: str = "clip") -> np.ndarray:
    """audio.toml's [voice] chain: resample to the project's rate, high-pass
    (4th order), trim silence with margins, normalise to `target_lufs_i`, and
    hold the true peak at or under `peak_dbtp` (limiting, then if need be
    lowering the whole clip)."""
    settings = config.voice
    out_sr = config.sample_rate
    x = _resample(np.nan_to_num(np.asarray(pcm, dtype=np.float64)).ravel(), sr, out_sr)
    if not np.any(np.abs(x) > 1e-6):
        raise AudioError(f"{what}: is silent")
    highpass = {"type": "highpass", "hz": settings["highpass_hz"]}
    x = dsp.apply_filter(dsp.apply_filter(x, out_sr, highpass), out_sr, highpass)
    target, ceiling = settings["target_lufs_i"], settings["peak_dbtp"]
    x = loudness.normalise(x, out_sr, "integrated", target, what)
    x = _trim(x, out_sr, settings["trim_db"], settings["keep_before_ms"], settings["keep_after_ms"])
    if not len(x):
        raise AudioError(f"{what}: is silent")
    for attempt in range(6):
        x = loudness.normalise(x, out_sr, "integrated", target, what)
        if loudness.true_peak_db(x) <= ceiling:
            return x
        x = dsp.limit(x, out_sr, ceiling - 0.5 - 0.25 * attempt, release_ms=80)
    peak = loudness.true_peak_db(x)
    return x * dsp.db2lin(min(0.0, ceiling - 0.05 - peak))


def write_wav(path: Path, x: np.ndarray, sr: int) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, np.asarray(x, dtype=np.float64), sr, subtype="PCM_24")
    return path


# Design --------------------------------------------------------------------------------


def select_candidate(similarities: list[float], threshold: float = THRESHOLD) -> tuple[int, bool]:
    """The candidate kept: the most similar of those at or above `threshold`;
    with none there, the most similar, flagged (True)."""
    if not similarities:
        raise AudioError("no candidates to choose from")
    best = int(np.argmax(similarities))
    return best, similarities[best] < threshold


@dataclass
class DesignResult:
    narrator: str
    similarities: dict[str, list[float]] = field(default_factory=dict)
    kept: dict[str, int] = field(default_factory=dict)
    flagged: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {"narrator": self.narrator, "similarities": self.similarities, "kept": self.kept, "flagged": self.flagged}

    @classmethod
    def from_json(cls, data: dict) -> "DesignResult":
        return cls(data["narrator"], data["similarities"], data["kept"], data["flagged"])


def _narrator(narrator: str) -> Narrator:
    if narrator not in NARRATORS:
        raise AudioError(f"unknown narrator '{narrator}' (expected one of {', '.join(NARRATORS)})")
    return NARRATORS[narrator]


def design_voice(
    config: Config,
    narrator: str,
    engine,
    encoder,
    out: Path,
    emotions: list[str] | None = None,
    candidates: int = CANDIDATES,
    echo=print,
) -> DesignResult:
    """Designs a narrator's clips into `out/neutral_candidates/<N>_<k>.wav` and
    `out/designed/<N>/<emotion>.wav` (and `design.json`, the similarities)."""
    voice = _narrator(narrator)
    emotions = emotions or design_emotions()
    for emotion in emotions:
        emotion_spec(emotion)
    sr = config.sample_rate
    folder = Path(out) / "designed" / narrator
    result = DesignResult(narrator)

    neutral = []
    for k in range(candidates):
        pcm, engine_sr = engine.design(voice.description, voice.reference_text, None, voice.seed + k)
        clip = postprocess(pcm, engine_sr, config, f"narrator {narrator} neutral candidate {k}")
        write_wav(Path(out) / "neutral_candidates" / f"{narrator}_{k}.wav", clip, sr)
        neutral.append(clip)
    write_wav(folder / "neutral.wav", neutral[0], sr)
    reference = encoder.embed(neutral[0], sr)
    echo(f"narrator {narrator}: neutral = candidate 0 of {candidates}")

    for emotion in emotions:
        if emotion == "neutral":
            continue
        instruction = emotion_spec(emotion).instruction
        clips, scores = [], []
        for k in range(candidates):
            pcm, engine_sr = engine.design(voice.description, voice.reference_text, instruction, voice.seed + k)
            clip = postprocess(pcm, engine_sr, config, f"narrator {narrator} {emotion} candidate {k}")
            clips.append(clip)
            scores.append(round(cosine(reference, encoder.embed(clip, sr)), 4))
        kept, flagged = select_candidate(scores)
        result.similarities[emotion] = scores
        result.kept[emotion] = kept
        if flagged:
            result.flagged.append(emotion)
        write_wav(folder / f"{emotion}.wav", clips[kept], sr)
        marks = "  ".join(f"{k}:{s:.3f}{'*' if k == kept else ''}" for k, s in enumerate(scores))
        echo(f"narrator {narrator} {emotion:<10} {marks}{'   FLAGGED: none reaches 0.75' if flagged else ''}")
    (folder / "design.json").write_text(json.dumps(result.to_json(), indent=2) + "\n", encoding="utf-8")
    return result


# The bake-off ------------------------------------------------------------------------------


@dataclass(frozen=True)
class BakeoffJob:
    line: int
    configuration: str
    narrator: str
    emotion: str
    text: str
    seed: int


def _seed(configuration: str, narrator: str, line: int) -> int:
    digest = hashlib.sha256(f"bakeoff:{configuration}:{narrator}:{line}".encode()).hexdigest()
    return int(digest[:8], 16)


def bakeoff_jobs() -> list[BakeoffJob]:
    jobs = []
    for configuration, narrator in RUNS:
        for line, (text, emotion) in enumerate(BAKEOFF_LINES, start=1):
            if configuration == "b" and line in SIGH_LINES:
                text = f"[sigh] {text}"
            jobs.append(BakeoffJob(line, configuration, narrator, emotion, text, _seed(configuration, narrator, line)))
    return jobs


def _designed(out: Path, narrator: str, emotions: list[str], candidates: int) -> DesignResult | None:
    folder = out / "designed" / narrator
    record = folder / "design.json"
    files = [folder / f"{e}.wav" for e in emotions] + [
        out / "neutral_candidates" / f"{narrator}_{k}.wav" for k in range(candidates)
    ]
    if not record.exists() or not all(f.exists() for f in files):
        return None
    result = DesignResult.from_json(json.loads(record.read_text(encoding="utf-8")))
    # A design of fewer emotions or other candidates since leaves clips its record does not vouch for.
    for emotion in emotions:
        if emotion != "neutral" and len(result.similarities.get(emotion, [])) != candidates:
            return None
    return result


def _render_job(job: BakeoffJob, out: Path) -> RenderJob:
    configuration = CONFIGURATIONS[job.configuration]
    pin = PINS[configuration.engine]
    voice = {"engine": configuration.engine, "model": pin.repo, "revision": pin.revision, "params": {}}
    clip, instruction = None, None
    if configuration.clip == "emotion":
        clip = out / "designed" / job.narrator / f"{job.emotion}.wav"
    elif configuration.clip == "neutral":
        clip = out / "designed" / job.narrator / "neutral.wav"
    if configuration.preset:
        voice["preset"] = configuration.preset
        instruction = qwen_instruction(job.emotion)
    return RenderJob(
        text=job.text, emotion=job.emotion, intensity=0.5, seed=job.seed, voice=voice,
        reference_clip=clip, instruction=instruction,
    )


SCORE_HEAD = """# Narration bake-off: score sheet

**Do not open `key.json` until the first pass is done**: it says which clip
is which configuration and narrator.

**First pass, blind.** Listen to each clip `c01.wav` … `c32.wav` in this
folder (in any order; the labels are shuffled; the line list below gives each
line's intended mood) and fill these columns of its row:

- **Naturalness 1–5**: 5 sounds like a person reading; 1 is plainly synthetic.
- **Emotion fit 1–5**: how well the delivery fits the line's mood.
- **Artifact (y/n, note)**: mispronunciation, a glitch, a click, a cut word,
  a strange breath. Name it.

**Second pass, with the key.** Now open `key.json`: each clip's `configuration`
and `narrator` say which of the four sets it belongs to (a/A, b/A, c/A, a/B),
and `line` which line it reads. For each set, play its line 1 and then each
of its other clips, and fill **Same voice as line 1 (y/n)**: does it sound
like the same speaker?

The gate: a configuration is adoptable when its mean naturalness is at least
**4.0**, its mean emotion fit at least **3.5**, every clip is the same voice,
and every artifact would be fixed by at most three takes.

Then listen to `neutral_candidates/` (four neutral readings for each
narrator, `A_0` … `A_3` and `B_0` … `B_3`; `_0` is the one the clips were
cloned from) and name the one to keep for the narrator you prefer.

Return: this sheet filled; the configuration (a, b or c) and narrator (A or B)
you choose, or "none passes"; and the neutral candidate to keep (e.g. `B_2`).

The eight lines, for reference (each set reads all eight):

{lines}
{flags}
| Label | Naturalness 1–5 | Emotion fit 1–5 | Same voice as line 1 (y/n) | Artifact (y/n, note) |
| --- | --- | --- | --- | --- |
"""


def _score_sheet(labels: list[str], designs: dict[str, DesignResult]) -> str:
    lines = "\n".join(f"{n}. ({emotion}) {text}" for n, (text, emotion) in enumerate(BAKEOFF_LINES, start=1))
    flagged = [
        f"- {d.narrator} {e} (best similarity {max(d.similarities[e]):.2f})"
        for d in designs.values()
        for e in d.flagged
    ]
    flags = (
        "\n**Designed clips flagged** (no candidate reached speaker similarity 0.75 to the "
        "neutral clip, so the closest was kept; expect those clips to drift from the voice):\n\n"
        + "\n".join(flagged)
        + "\n"
        if flagged
        else ""
    )
    head = SCORE_HEAD.format(lines=lines, flags=flags)
    return head + "".join(f"| {label} |  |  |  |  |\n" for label in labels)


def bakeoff(
    config: Config,
    engines: dict,
    encoder,
    redesign: bool = False,
    candidates: int = CANDIDATES,
    echo=print,
) -> Path:
    out = Path(config.root) / "bakeoff"
    out.mkdir(parents=True, exist_ok=True)
    sr = config.sample_rate
    emotions = design_emotions()
    designs = {}
    for narrator in sorted({n for _, n in RUNS}):
        found = None if redesign else _designed(out, narrator, emotions, candidates)
        if found:
            echo(f"narrator {narrator}: reusing designed/{narrator}/ (--redesign to make it again)")
            designs[narrator] = found
        else:
            designs[narrator] = design_voice(
                config, narrator, engines["qwen3_design"], encoder, out, emotions, candidates, echo
            )

    jobs = bakeoff_jobs()
    order = list(range(len(jobs)))
    random.Random(LABEL_SEED).shuffle(order)
    labels = [f"c{n:02d}" for n in range(1, len(jobs) + 1)]
    key = {}
    echo(f"{'label':<5}  {'run':<4} {'line':>4}  {'LUFS-I':>6}  {'dBTP':>5}  {'s':>5}")
    for label, index in zip(labels, order):
        job = jobs[index]
        engine = engines[CONFIGURATIONS[job.configuration].engine]
        what = f"line {job.line}, configuration {job.configuration}, narrator {job.narrator}"
        pcm, engine_sr = engine.render(_render_job(job, out))
        clip = postprocess(pcm, engine_sr, config, what)
        write_wav(out / f"{label}.wav", clip, sr)
        key[label] = {
            "line": job.line,
            "configuration": job.configuration,
            "narrator": job.narrator,
            "emotion": job.emotion,
            "text": job.text,
            "seed": job.seed,
            "engine": engine.fingerprint(),
            "adapter_version": ADAPTER_VERSION,
        }
        echo(
            f"{label:<5}  {job.configuration}/{job.narrator}  {job.line:>4}  "
            f"{loudness.integrated(clip, sr):>6.1f}  {loudness.true_peak_db(clip):>5.1f}  {len(clip) / sr:>5.1f}"
        )
    (out / "key.json").write_text(json.dumps(key, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out / "score.md").write_text(_score_sheet(labels, designs), encoding="utf-8")
    return out


def real_engines() -> dict:
    from .tts import chatterbox, chatterbox_turbo, qwen3_custom, qwen3_design

    return {m.Engine.name: m.Engine() for m in (chatterbox, chatterbox_turbo, qwen3_custom, qwen3_design)}


def real_encoder():
    from .tts.similarity import ChatterboxEncoder

    return ChatterboxEncoder()
