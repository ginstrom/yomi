"""The adapter every narration engine sits behind (design §5.8.4, §5.8.5).

A `RenderJob` says what to speak and how; an `Engine` turns it into mono
float32 PCM at the engine's own sample rate. `EMOTION_MAP` is the design's
emotion table: the reference clip a Chatterbox voice clones for the emotion,
the `exaggeration` interpolated by intensity, Chatterbox's `cfg_weight`, and
the instruction Qwen3-TTS is given (in clip design and as the fallback).
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np

from ..errors import AudioError

# Raised whenever what an engine is given, or how it reads it, changes: every
# rendered line's hash includes it, so a raise renders every line again.
ADAPTER_VERSION = 1

DEFAULT_INTENSITY = 0.5


@dataclass(frozen=True)
class RenderJob:
    text: str                       # spoken text, tags included where allowed
    emotion: str
    intensity: float                # 0..1
    seed: int
    voice: dict                     # the voice's resolved table (engine, model, revision, params, ...)
    reference_clip: Path | None     # chatterbox engines: the emotion's clip
    instruction: str | None         # qwen3 engines


class Engine(Protocol):
    name: str

    def render(self, job: RenderJob) -> tuple[np.ndarray, int]: ...

    def fingerprint(self) -> dict: ...


@dataclass(frozen=True)
class EmotionSpec:
    clip: str
    exaggeration: tuple[float, float]
    cfg_weight: float
    instruction: str


EMOTION_MAP: dict[str, EmotionSpec] = {
    "neutral": EmotionSpec("neutral", (0.35, 0.50), 0.50, "Speak calmly and evenly, as a storyteller."),
    "warm": EmotionSpec("warm", (0.40, 0.60), 0.50, "Warm, gentle and reassuring."),
    "grave": EmotionSpec("grave", (0.40, 0.65), 0.45, "Low, solemn and slow, with gravity."),
    "tense": EmotionSpec("tense", (0.50, 0.80), 0.40, "Tense and urgent, hushed but quick."),
    "afraid": EmotionSpec("afraid", (0.60, 0.90), 0.35, "Frightened, breath unsteady."),
    "angry": EmotionSpec("angry", (0.60, 1.00), 0.30, "Angry and forceful, clipped."),
    "sad": EmotionSpec("sad", (0.40, 0.70), 0.45, "Sorrowful and subdued, slow."),
    "triumphant": EmotionSpec("triumphant", (0.60, 0.90), 0.35, "Triumphant and rousing, ringing."),
    "whisper": EmotionSpec("whisper", (0.30, 0.50), 0.50, "Whispering, breathy and close."),
}

# Qwen3's wording of intensity: "slightly" below this, "very" above the next.
SLIGHTLY_BELOW = 0.34
VERY_ABOVE = 0.67


def emotion_spec(emotion: str) -> EmotionSpec:
    if emotion not in EMOTION_MAP:
        raise AudioError(f"unknown emotion '{emotion}' (expected one of {', '.join(EMOTION_MAP)})")
    return EMOTION_MAP[emotion]


def _check_intensity(intensity: float) -> float:
    if not 0.0 <= intensity <= 1.0:
        raise AudioError(f"intensity {intensity} is outside 0 to 1")
    return intensity


def exaggeration(emotion: str, intensity: float = DEFAULT_INTENSITY) -> float:
    """Chatterbox's `exaggeration` for an emotion at an intensity: linear
    from the table's low value (intensity 0) to its high value (1)."""
    lo, hi = emotion_spec(emotion).exaggeration
    return lo + (hi - lo) * _check_intensity(intensity)


def qwen_instruction(emotion: str, intensity: float = DEFAULT_INTENSITY) -> str:
    """The emotion's Qwen3 instruction with the intensity worded into it:
    led by "Slightly so." below 0.34, "Very much so." above 0.67, else as written."""
    instruction = emotion_spec(emotion).instruction
    _check_intensity(intensity)
    if intensity < SLIGHTLY_BELOW:
        return f"Slightly so. {instruction}"
    if intensity > VERY_ABOVE:
        return f"Very much so. {instruction}"
    return instruction
