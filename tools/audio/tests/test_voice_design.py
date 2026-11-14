"""`voice design <voice>` (design §5.8.3) over a fake design engine and encoder."""
import json
import tomllib
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from conftest import run_cli
from test_voice import ENGINE_SR, FakeDesign, FakeEncoder, babble
from yomi_audio import loudness
from yomi_audio.config import load_config
from yomi_audio.design import design_emotions, read_voice
from yomi_audio.errors import AudioError
from yomi_audio.tts.base import EMOTION_MAP
from yomi_audio.tts.models import PINS

REPO_VOICES = Path(__file__).resolve().parents[3] / "audio" / "voices.toml"

VOICES = """\
adapter_version = 1

[narrator]
engine = "chatterbox_turbo"
model = "m"
revision = "r"
emotions = ["neutral", "warm", "grave", "whisper"]

[narrator.design]
model = "design-model"
revision = "design-rev"
description = "A weathered storyteller."
reference_text = "The old road winds north."
seed = 7

[narrator.clips]
neutral = "voices/narrator/neutral.flac"
"""


@pytest.fixture
def voiced(project):
    (project / "voices.toml").write_text(VOICES, encoding="utf-8")
    return project


def neutral_wav(tmp_path) -> Path:
    path = tmp_path / "neutral_in.wav"
    sf.write(path, babble(7, "The old road winds north."), ENGINE_SR)
    return path


def run(project, tmp_path, encoder=None, engine=None, **kwargs):
    kwargs.setdefault("neutral", neutral_wav(tmp_path))
    kwargs.setdefault("out", tmp_path / "out")
    return design_emotions(
        load_config(project), "narrator", engine or FakeDesign(), encoder or FakeEncoder(), echo=lambda *_: None, **kwargs
    )


# The voice's table ----------------------------------------------------------------


def test_read_voice_resolves_the_table_and_its_design(voiced):
    table = read_voice(voiced, "narrator")
    assert table["emotions"] == ["neutral", "warm", "grave", "whisper"]
    assert table["design"]["seed"] == 7


def test_read_voice_names_an_unknown_voice(voiced):
    with pytest.raises(AudioError, match="unknown voice 'elder'"):
        read_voice(voiced, "elder")


def test_read_voice_names_a_missing_design_field(voiced):
    (voiced / "voices.toml").write_text(VOICES.replace('seed = 7\n', ''), encoding="utf-8")
    with pytest.raises(AudioError, match=r"narrator\.design\.seed"):
        read_voice(voiced, "narrator")


# Design ---------------------------------------------------------------------------


def test_designs_every_declared_emotion_but_neutral_by_default(voiced, tmp_path):
    engine = FakeDesign()
    result = run(voiced, tmp_path, engine=engine)
    assert list(result.emotions) == ["warm", "grave", "whisper"]
    assert len(engine.designs) == 3 * 4
    out = tmp_path / "out"
    assert sorted(p.name for p in out.glob("*.wav")) == sorted(
        ["neutral.wav"] + [f"{e}_{k}.wav" for e in ("warm", "grave", "whisper") for k in range(4)]
    )


def test_honours_emotions_and_candidates(voiced, tmp_path):
    engine = FakeDesign()
    result = run(voiced, tmp_path, engine=engine, emotions=["whisper"], candidates=2)
    assert list(result.emotions) == ["whisper"]
    assert [d[3] for d in engine.designs] == [7, 8]
    assert sorted(p.name for p in (tmp_path / "out").glob("whisper_*.wav")) == ["whisper_0.wav", "whisper_1.wav"]


def test_appends_each_emotions_instruction_to_the_description(voiced, tmp_path):
    engine = FakeDesign()
    run(voiced, tmp_path, engine=engine, emotions=["grave", "warm"], candidates=1)
    assert [(d[0], d[1], d[2]) for d in engine.designs] == [
        ("A weathered storyteller.", "The old road winds north.", EMOTION_MAP["grave"].instruction),
        ("A weathered storyteller.", "The old road winds north.", EMOTION_MAP["warm"].instruction),
    ]


def test_discards_candidates_below_the_threshold(voiced, tmp_path):
    # The neutral reference, then candidates 0 to 3 of "grave": 0 and 2 are another voice.
    encoder = FakeEncoder([[1, 0], [0, 1], [1, 0.2], [0.5, 1], [1, 0.5]])
    result = run(voiced, tmp_path, encoder=encoder, emotions=["grave"])
    offered = [c.k for c in result.emotions["grave"] if c.offered]
    assert offered == [1, 3]
    assert sorted(p.name for p in (tmp_path / "out").glob("grave_*.wav")) == ["grave_1.wav", "grave_3.wav"]
    assert all(c.similarity >= 0.75 for c in result.emotions["grave"] if c.offered)


def test_says_so_when_no_candidate_reaches_the_threshold(voiced, tmp_path):
    lines = []
    encoder = FakeEncoder([[1, 0]] + [[0, 1]] * 4)
    design_emotions(
        load_config(voiced), "narrator", FakeDesign(), encoder, neutral=neutral_wav(tmp_path),
        out=tmp_path / "out", emotions=["warm"], echo=lines.append,
    )
    assert not list((tmp_path / "out").glob("warm_*.wav"))
    review = (tmp_path / "out" / "review.md").read_text()
    assert "--candidates 8" in review
    assert any("--candidates 8" in line for line in lines)


def test_writes_the_review_sheet_and_post_processed_clips(voiced, tmp_path):
    run(voiced, tmp_path, emotions=["grave", "whisper"], candidates=2)
    out = tmp_path / "out"
    review = (out / "review.md").read_text()
    for word in ("grave", "whisper", "grave_0.wav", "whisper_1.wav", "Similarity", "LUFS", "Seed", "0.75", "none, redo with seed"):
        assert word in review
    config = load_config(tmp_path / "audio")
    for wav in out.glob("*.wav"):
        x, sr = sf.read(wav)
        assert sr == config.sample_rate
        assert loudness.integrated(x, sr) == pytest.approx(-18, abs=1.0), wav
        assert loudness.true_peak_db(x) <= -1.5 + 0.05, wav
    record = json.loads((out / "design.json").read_text())
    assert record["voice"] == "narrator"
    assert record["description"] == "A weathered storyteller."
    assert [c["seed"] for c in record["emotions"]["grave"]] == [7, 8]


def test_a_later_run_for_one_emotion_keeps_the_others_and_replaces_its_own(voiced, tmp_path):
    neutral = neutral_wav(tmp_path)
    run(voiced, tmp_path, neutral=neutral, emotions=["grave", "whisper"], candidates=3)
    run(voiced, tmp_path, neutral=neutral, emotions=["grave"], candidates=1)
    out = tmp_path / "out"
    assert sorted(p.name for p in out.glob("grave_*.wav")) == ["grave_0.wav"]
    assert len(list(out.glob("whisper_*.wav"))) == 3
    record = json.loads((out / "design.json").read_text())
    assert sorted(record["emotions"]) == ["grave", "whisper"]
    assert "whisper_2.wav" in (out / "review.md").read_text()


def test_a_new_neutral_reference_drops_every_earlier_candidate(voiced, tmp_path):
    run(voiced, tmp_path, emotions=["grave", "whisper"], candidates=2)
    other = tmp_path / "other.wav"
    sf.write(other, babble(99, "Something else entirely, spoken."), ENGINE_SR)
    run(voiced, tmp_path, neutral=other, emotions=["grave"], candidates=2)
    out = tmp_path / "out"
    assert not list(out.glob("whisper_*.wav"))
    assert sorted(json.loads((out / "design.json").read_text())["emotions"]) == ["grave"]


def test_uses_the_voices_committed_neutral_clip_without_neutral(voiced, tmp_path):
    clip = voiced / "voices" / "narrator" / "neutral.flac"
    clip.parent.mkdir(parents=True)
    sf.write(clip, babble(7, "The old road winds north."), ENGINE_SR)
    result = run(voiced, tmp_path, neutral=None, emotions=["warm"], candidates=1)
    assert result.neutral == clip


def test_refuses_without_a_neutral_reference(voiced, tmp_path):
    with pytest.raises(AudioError, match=r"voices/narrator/neutral\.flac"):
        run(voiced, tmp_path, neutral=None)
    with pytest.raises(AudioError, match="missing.wav"):
        run(voiced, tmp_path, neutral=tmp_path / "missing.wav")


def test_refuses_an_emotion_the_voice_does_not_declare(voiced, tmp_path):
    with pytest.raises(AudioError, match="'angry'"):
        run(voiced, tmp_path, emotions=["angry"])
    with pytest.raises(AudioError, match="neutral"):
        run(voiced, tmp_path, emotions=["neutral"])


# The command line ------------------------------------------------------------------


def test_cli_refuses_without_a_neutral_reference(voiced):
    result = run_cli("voice", "design", "narrator", "--root", str(voiced))
    assert result.returncode == 1
    assert "voices/narrator/neutral.flac" in result.stderr
    assert "Traceback" not in result.stderr


def test_cli_names_an_unknown_voice(voiced):
    result = run_cli("voice", "design", "elder", "--root", str(voiced))
    assert result.returncode == 1
    assert "unknown voice 'elder'" in result.stderr


def test_cli_refuses_fewer_than_one_candidate(voiced):
    result = run_cli("voice", "design", "narrator", "--candidates", "0", "--root", str(voiced))
    assert result.returncode == 1
    assert "--candidates" in result.stderr


# The real registry -------------------------------------------------------------------


def test_the_narrator_is_pinned_to_the_models_the_engines_load():
    voices = tomllib.loads(REPO_VOICES.read_text(encoding="utf-8"))
    narrator = voices["narrator"]
    pin = PINS[narrator["engine"]]
    assert (narrator["model"], narrator["revision"]) == (pin.repo, pin.revision)
    design = PINS["qwen3_design"]
    assert (narrator["design"]["model"], narrator["design"]["revision"]) == (design.repo, design.revision)
    fallback = narrator["fallback"]
    pin = PINS[fallback["engine"]]
    assert (fallback["model"], fallback["revision"]) == (pin.repo, pin.revision)
    assert fallback["preset"]
    assert narrator["clips"]["neutral"] == "voices/narrator/neutral.flac"
    assert set(narrator["clips"]) <= set(narrator["emotions"])
