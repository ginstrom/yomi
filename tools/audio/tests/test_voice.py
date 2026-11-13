"""`voice design` and `voice bakeoff` over fake engines: no weights, no network."""
import json
import re

import numpy as np
import pytest
import soundfile as sf

from yomi_audio import loudness
from yomi_audio.config import load_config
from yomi_audio.errors import AudioError
from yomi_audio.voice import (
    BAKEOFF_LINES,
    CONFIGURATIONS,
    NARRATORS,
    SIGH_LINES,
    bakeoff,
    bakeoff_jobs,
    design_voice,
    postprocess,
    select_candidate,
)

ENGINE_SR = 24000


def babble(seed: int, text: str, sr: int = ENGINE_SR, level: float = 0.3, noisy: bool = False) -> np.ndarray:
    """Speech-like sound: voiced syllables with silence around them, its length
    by the text's, deterministic by seed and text. `noisy` makes it peaky
    (noise bursts), so that post-processing has to limit it."""
    rng = np.random.default_rng([seed, len(text)])
    syllables = max(3, len(text) // 4)
    syllable = int(0.12 * sr)
    envelope = np.concatenate([np.hanning(syllable) * rng.uniform(0.5, 1.0) for _ in range(syllables)])
    tone = np.sin(2 * np.pi * rng.uniform(110, 220) * np.arange(len(envelope)) / sr)
    speech = level * envelope * tone
    if noisy:
        speech = speech + level * envelope * rng.standard_normal(len(envelope))
    pad = np.zeros(int(0.5 * sr))
    return np.concatenate([pad, speech, pad]).astype(np.float32)


class FakeEngine:
    def __init__(self, name):
        self.name = name
        self.jobs = []

    def render(self, job):
        self.jobs.append(job)
        return babble(job.seed, job.text), ENGINE_SR

    def fingerprint(self):
        return {"engine": self.name}


class FakeDesign(FakeEngine):
    def __init__(self):
        super().__init__("qwen3_design")
        self.designs = []

    def design(self, description, text, instruction, seed):
        self.designs.append((description, text, instruction, seed))
        return babble(seed + 17 * len(instruction or ""), text), ENGINE_SR


class FakeEncoder:
    """Embeds a clip by the order it is asked: each call's vector comes from
    `vectors` in turn, else a fixed one."""

    def __init__(self, vectors=None):
        self.vectors = list(vectors or [])

    def embed(self, pcm, sr):
        return np.array(self.vectors.pop(0) if self.vectors else [1.0, 0.0])


def fake_engines():
    return {
        "chatterbox": FakeEngine("chatterbox"),
        "chatterbox_turbo": FakeEngine("chatterbox_turbo"),
        "qwen3_custom": FakeEngine("qwen3_custom"),
        "qwen3_design": FakeDesign(),
    }


# Selection ---------------------------------------------------------------------


def test_select_keeps_the_most_similar_above_the_threshold():
    assert select_candidate([0.80, 0.91, 0.60, 0.88]) == (1, False)


def test_select_discards_below_the_threshold_and_flags_when_none_passes():
    assert select_candidate([0.70, 0.74, 0.20, 0.10]) == (1, True)


def test_select_refuses_no_candidates():
    with pytest.raises(AudioError):
        select_candidate([])


# Post-processing -----------------------------------------------------------------


def test_postprocess_meets_the_voice_targets(project):
    config = load_config(project)
    x = postprocess(babble(3, "A fairly long line of speech to measure.", noisy=True), ENGINE_SR, config)
    settings = config.voice
    assert loudness.integrated(x, config.sample_rate) == pytest.approx(settings["target_lufs_i"], abs=1.0)
    assert loudness.true_peak_db(x) <= settings["peak_dbtp"] + 1e-6


def test_postprocess_trims_silence_keeping_the_margins(project):
    config = load_config(project)
    raw = babble(4, "Trim me.")
    x = postprocess(raw, ENGINE_SR, config)
    sr = config.sample_rate
    # 0.5 s of silence each side becomes ~120 ms before and ~250 ms after.
    expected = (len(raw) - ENGINE_SR) / ENGINE_SR + 0.12 + 0.25
    assert len(x) / sr == pytest.approx(expected, abs=0.03)


def test_postprocess_refuses_silence(project):
    config = load_config(project)
    with pytest.raises(AudioError, match="silent"):
        postprocess(np.zeros(ENGINE_SR, dtype=np.float32), ENGINE_SR, config, what="line 1")


# Design ----------------------------------------------------------------------------


def test_design_writes_candidates_and_keeps_the_most_similar_clip(project, tmp_path):
    config = load_config(project)
    engine = FakeDesign()
    # Neutral candidate 0 is the reference; then 4 candidates for "warm".
    encoder = FakeEncoder([[1, 0], [0.5, 1], [1, 0.1], [1, 0.9], [0, 1]])
    result = design_voice(
        config, "A", engine, encoder, tmp_path, emotions=["neutral", "warm"], candidates=4, echo=lambda *_: None
    )
    assert sorted(p.name for p in (tmp_path / "neutral_candidates").iterdir()) == [f"A_{k}.wav" for k in range(4)]
    assert result.kept["warm"] == 1
    assert result.flagged == []
    assert (tmp_path / "designed" / "A" / "warm.wav").exists()
    assert (tmp_path / "designed" / "A" / "neutral.wav").exists()
    seeds = [d[3] for d in engine.designs]
    base = NARRATORS["A"].seed
    assert seeds == [base, base + 1, base + 2, base + 3] * 2
    # The neutral candidates read the description alone; the emotions append their instruction.
    assert [d[2] for d in engine.designs[:4]] == [None] * 4
    assert all("Warm, gentle" in d[2] for d in engine.designs[4:])
    assert all(d[1] == NARRATORS["A"].reference_text for d in engine.designs)


def test_design_flags_an_emotion_with_no_candidate_above_the_threshold(project, tmp_path):
    config = load_config(project)
    encoder = FakeEncoder([[1, 0], [0, 1], [0.2, 1], [0.1, 1], [0, 1]])
    result = design_voice(
        config, "B", FakeDesign(), encoder, tmp_path, emotions=["neutral", "grave"], candidates=4, echo=lambda *_: None
    )
    assert result.flagged == ["grave"]
    assert result.kept["grave"] == 1


def test_design_refuses_an_unknown_narrator(project, tmp_path):
    with pytest.raises(AudioError, match="'C'"):
        design_voice(load_config(project), "C", FakeDesign(), FakeEncoder(), tmp_path, echo=lambda *_: None)


# Bake-off ------------------------------------------------------------------------


def test_bakeoff_has_32_distinct_jobs_with_sighs_only_on_turbo_lines_3_6_7():
    jobs = bakeoff_jobs()
    assert len(jobs) == 32
    assert len({(j.line, j.configuration, j.narrator) for j in jobs}) == 32
    assert {(j.configuration, j.narrator) for j in jobs} == {("a", "A"), ("b", "A"), ("c", "A"), ("a", "B")}
    tagged = {(j.configuration, j.line) for j in jobs if "[sigh]" in j.text}
    assert tagged == {("b", n) for n in SIGH_LINES} == {("b", 3), ("b", 6), ("b", 7)}
    assert [e for _, e in BAKEOFF_LINES] == ["neutral", "warm", "grave", "tense", "triumphant", "sad", "whisper", "neutral"]


def test_bakeoff_writes_the_listening_test(project):
    config = load_config(project)
    engines = fake_engines()
    out = bakeoff(config, engines, FakeEncoder(), echo=lambda *_: None)
    assert out == project / "bakeoff"
    labels = [f"c{n:02d}" for n in range(1, 33)]
    assert sorted(p.stem for p in out.glob("*.wav")) == labels

    key = json.loads((out / "key.json").read_text())
    assert sorted(key) == labels
    triples = {(v["line"], v["configuration"], v["narrator"]) for v in key.values()}
    assert len(triples) == 32
    assert {(c, n) for _, c, n in triples} == {("a", "A"), ("b", "A"), ("c", "A"), ("a", "B")}

    score = (out / "score.md").read_text()
    rows = re.findall(r"^\| (c\d\d) \|", score, flags=re.M)
    assert rows == labels
    assert "key.json" in score.split("|")[0]
    for word in ("Naturalness", "Emotion fit", "Same voice", "Artifact", "4.0", "3.5"):
        assert word in score

    candidates = sorted(p.name for p in (out / "neutral_candidates").iterdir())
    assert candidates == [f"{n}_{k}.wav" for n in "AB" for k in range(4)]
    for narrator in "AB":
        for emotion in ("neutral", "warm", "grave", "tense", "triumphant", "sad", "whisper"):
            assert (out / "designed" / narrator / f"{emotion}.wav").exists()

    for wav in [*out.glob("*.wav"), *(out / "neutral_candidates").glob("*.wav"), *(out / "designed").rglob("*.wav")]:
        x, sr = sf.read(wav)
        assert sr == config.sample_rate
        assert loudness.integrated(x, sr) == pytest.approx(-18, abs=1.0), wav
        assert loudness.true_peak_db(x) <= -1.5 + 0.05, wav


def test_bakeoff_routes_each_configuration_to_its_engine_and_clip(project):
    config = load_config(project)
    engines = fake_engines()
    out = bakeoff(config, engines, FakeEncoder(), echo=lambda *_: None)
    a_jobs = engines["chatterbox"].jobs
    assert len(a_jobs) == 16
    for job in a_jobs:
        narrator = job.reference_clip.parent.name
        assert job.reference_clip == out / "designed" / narrator / f"{job.emotion}.wav"
        assert job.instruction is None
    turbo = engines["chatterbox_turbo"].jobs
    assert len(turbo) == 8 and all(j.reference_clip == out / "designed" / "A" / "neutral.wav" for j in turbo)
    custom = engines["qwen3_custom"].jobs
    assert len(custom) == 8
    assert all(j.voice["preset"] == CONFIGURATIONS["c"].preset and j.instruction for j in custom)
    assert all(j.reference_clip is None for j in custom)


def test_bakeoff_labels_are_deterministic_and_designs_are_reused(project):
    config = load_config(project)
    first = bakeoff(config, fake_engines(), FakeEncoder(), echo=lambda *_: None)
    key_one = (first / "key.json").read_text()
    engines = fake_engines()
    bakeoff(config, engines, FakeEncoder(), echo=lambda *_: None)
    assert (first / "key.json").read_text() == key_one
    assert engines["qwen3_design"].designs == []  # designed/ was reused
    engines = fake_engines()
    bakeoff(config, engines, FakeEncoder(), redesign=True, echo=lambda *_: None)
    assert len(engines["qwen3_design"].designs) == 2 * 4 * 7


def test_bakeoff_flags_a_weak_design_in_the_score_sheet(project):
    config = load_config(project)
    # A's neutral, then 4 per emotion; make every candidate of A's first emotion dissimilar.
    vectors = [[1, 0]] + [[0, 1]] * 4
    out = bakeoff(config, fake_engines(), FakeEncoder(vectors), echo=lambda *_: None)
    header = (out / "score.md").read_text().split("| Label")[0]
    assert "A warm" in header


def test_cli_names_an_unknown_narrator(project):
    from conftest import run_cli

    result = run_cli("voice", "design", "C", "--root", str(project))
    assert result.returncode == 1
    assert "unknown narrator 'C'" in result.stderr
    assert "Traceback" not in result.stderr
