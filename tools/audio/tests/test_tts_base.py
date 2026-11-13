"""The adapter's pure parts: the emotion table, intensity, the Qwen3 wording,
and that the engines import without the `tts` extra."""
import subprocess
import sys

import pytest

from yomi_audio.errors import AudioError
from yomi_audio.tts.base import (
    ADAPTER_VERSION,
    EMOTION_MAP,
    RenderJob,
    exaggeration,
    qwen_instruction,
)

DESIGN_TABLE = {
    "neutral": ((0.35, 0.50), 0.50, "Speak calmly and evenly, as a storyteller."),
    "warm": ((0.40, 0.60), 0.50, "Warm, gentle and reassuring."),
    "grave": ((0.40, 0.65), 0.45, "Low, solemn and slow, with gravity."),
    "tense": ((0.50, 0.80), 0.40, "Tense and urgent, hushed but quick."),
    "afraid": ((0.60, 0.90), 0.35, "Frightened, breath unsteady."),
    "angry": ((0.60, 1.00), 0.30, "Angry and forceful, clipped."),
    "sad": ((0.40, 0.70), 0.45, "Sorrowful and subdued, slow."),
    "triumphant": ((0.60, 0.90), 0.35, "Triumphant and rousing, ringing."),
    "whisper": ((0.30, 0.50), 0.50, "Whispering, breathy and close."),
}


def test_adapter_version_is_one():
    assert ADAPTER_VERSION == 1


def test_emotion_map_matches_the_design_table():
    assert list(EMOTION_MAP) == list(DESIGN_TABLE)
    for emotion, (span, cfg, instruction) in DESIGN_TABLE.items():
        spec = EMOTION_MAP[emotion]
        assert spec.clip == emotion
        assert spec.exaggeration == span
        assert spec.cfg_weight == cfg
        assert spec.instruction == instruction


@pytest.mark.parametrize(
    "emotion, intensity, expected",
    [
        ("neutral", 0.0, 0.35), ("neutral", 0.5, 0.425), ("neutral", 1.0, 0.50),
        ("angry", 0.0, 0.60), ("angry", 0.5, 0.80), ("angry", 1.0, 1.00),
        ("whisper", 0.5, 0.40),
    ],
)
def test_exaggeration_is_interpolated_by_intensity(emotion, intensity, expected):
    assert exaggeration(emotion, intensity) == pytest.approx(expected)


@pytest.mark.parametrize("bad", [-0.01, 1.01])
def test_intensity_outside_zero_to_one_is_refused(bad):
    with pytest.raises(AudioError, match="intensity"):
        exaggeration("warm", bad)


def test_an_unknown_emotion_is_named():
    with pytest.raises(AudioError, match="'gleeful'"):
        exaggeration("gleeful", 0.5)
    with pytest.raises(AudioError, match="'gleeful'"):
        qwen_instruction("gleeful", 0.5)


def test_qwen_instruction_words_the_intensity():
    base = EMOTION_MAP["warm"].instruction
    low, mid, high = (qwen_instruction("warm", i) for i in (0.2, 0.5, 0.8))
    assert mid == base
    assert "slightly" in low.lower() and base in low and "very" not in low.lower()
    assert "very" in high.lower() and base in high and "slightly" not in high.lower()


def test_qwen_instruction_boundaries():
    base = EMOTION_MAP["sad"].instruction
    assert qwen_instruction("sad", 0.34) == base
    assert qwen_instruction("sad", 0.67) == base
    assert qwen_instruction("sad", 0.33) != base
    assert qwen_instruction("sad", 0.68) != base


def test_render_job_is_frozen():
    job = RenderJob(text="Hi.", emotion="neutral", intensity=0.5, seed=1, voice={}, reference_clip=None, instruction=None)
    with pytest.raises(Exception):
        job.text = "Bye."  # type: ignore[misc]


def test_engines_import_without_the_tts_extra():
    """The engine modules and the CLI load without touching mlx or torch."""
    code = (
        "import sys\n"
        "import yomi_audio.cli, yomi_audio.voice\n"
        "from yomi_audio.tts import chatterbox, chatterbox_turbo, qwen3_custom, qwen3_design, similarity, models\n"
        "for name in ('mlx', 'mlx_audio', 'torch'):\n"
        "    assert name not in sys.modules, name\n"
        "for module in (chatterbox, chatterbox_turbo, qwen3_custom, qwen3_design):\n"
        "    assert module.Engine.name in ('chatterbox', 'chatterbox_turbo', 'qwen3_custom', 'qwen3_design')\n"
    )
    result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
