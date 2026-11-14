"""`voice render` (design §5.8.5) over a fake engine: no weights, no network."""
import json
import shutil
import subprocess

import numpy as np
import pytest
import soundfile as sf

from conftest import run_cli
from test_voice import ENGINE_SR, FakeEngine, babble
from yomi_audio import loudness
from yomi_audio.config import load_config
from yomi_audio.errors import AudioError
from yomi_audio.render import render_lines

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg")

TABLE = {"engine": "chatterbox_turbo", "model": "m", "revision": "rev1", "emotions": ["neutral", "grave"],
         "clips": {"neutral": "voices/narrator/neutral.flac"}}
SETTINGS = {"highpass_hz": 70, "trim_db": -50, "keep_before_ms": 120, "keep_after_ms": 250,
            "target_lufs_i": -18, "peak_dbtp": -1.5}


def job(line, spoken, emotion="neutral", hash=None):
    return {"line": line, "spoken": spoken, "voice": "narrator", "voiceTable": TABLE, "emotion": emotion,
            "intensity": 0.5, "take": 0, "seed": len(line), "hash": hash or f"h-{line}-{spoken}"}


def write_jobs(root, jobs, adapter_version=1):
    (root / "narration.jobs.json").write_text(
        json.dumps({"adapter_version": adapter_version, "voice_settings": SETTINGS, "jobs": jobs}), encoding="utf-8")


@pytest.fixture
def narrated(project):
    (project / "voices.toml").write_text(
        'adapter_version = 1\n[narrator]\nengine = "chatterbox_turbo"\nmodel = "m"\nrevision = "rev1"\n'
        'emotions = ["neutral", "grave"]\n[narrator.clips]\nneutral = "voices/narrator/neutral.flac"\n', encoding="utf-8")
    clip = project / "voices" / "narrator" / "neutral.flac"
    clip.parent.mkdir(parents=True)
    sf.write(clip, babble(1, "reference"), ENGINE_SR, format="FLAC")
    return project


def render(root, engine=None, **kwargs):
    engine = engine or FakeEngine("chatterbox_turbo")
    report = render_lines(load_config(root), {"chatterbox_turbo": engine}, echo=lambda *_: None, **kwargs)
    return report, engine


def voice_files(root):
    return sorted(p.name for p in (root.parent / "public" / "assets" / "voice").glob("*") if p.suffix in (".opus", ".mp3"))


def manifest(root):
    return json.loads((root / "voice.manifest.json").read_text(encoding="utf-8"))


def test_first_render_renders_every_line_and_writes_the_manifest(narrated):
    write_jobs(narrated, [job("a.one", "The first line."), job("b.two", "The second, longer line goes on.", "grave")])
    report, engine = render(narrated)
    assert report.rendered == ["a.one", "b.two"] and report.skipped == []
    assert voice_files(narrated) == ["a.one.mp3", "a.one.opus", "b.two.mp3", "b.two.opus"]
    lines = manifest(narrated)["lines"]
    assert lines["a.one"]["hash"] == "h-a.one-The first line."
    assert lines["a.one"]["voice"] == "narrator" and lines["a.one"]["engine"] == "chatterbox_turbo@rev1"
    assert lines["b.two"]["durationMs"] > lines["a.one"]["durationMs"] > 0
    # the neutral clip is cloned for an emotion the voice has no clip for
    assert all(j.reference_clip.name == "neutral.flac" for j in engine.jobs)


def test_a_second_render_renders_nothing_and_leaves_the_manifest_alone(narrated):
    write_jobs(narrated, [job("a.one", "The first line.")])
    render(narrated)
    before = (narrated / "voice.manifest.json").read_bytes()
    report, engine = render(narrated)
    assert report.rendered == [] and report.skipped == ["a.one"] and engine.jobs == []
    assert (narrated / "voice.manifest.json").read_bytes() == before


def test_one_changed_line_renders_exactly_that_one(narrated):
    write_jobs(narrated, [job("a.one", "The first line."), job("b.two", "The second line.")])
    render(narrated)
    write_jobs(narrated, [job("a.one", "The first line."), job("b.two", "Changed words.")])
    report, engine = render(narrated)
    assert report.rendered == ["b.two"] and report.skipped == ["a.one"]
    assert [j.text for j in engine.jobs] == ["Changed words."]
    assert manifest(narrated)["lines"]["b.two"]["hash"] == "h-b.two-Changed words."


def test_a_missing_file_renders_its_line_again(narrated):
    write_jobs(narrated, [job("a.one", "The first line.")])
    render(narrated)
    (narrated.parent / "public" / "assets" / "voice" / "a.one.mp3").unlink()
    report, _ = render(narrated)
    assert report.rendered == ["a.one"] and "a.one.mp3" in voice_files(narrated)


def test_a_line_removed_from_the_jobs_loses_its_files_and_entry(narrated):
    write_jobs(narrated, [job("a.one", "The first line."), job("b.two", "The second line.")])
    render(narrated)
    readme = narrated.parent / "public" / "assets" / "voice" / "README.md"
    readme.write_text("keep", encoding="utf-8")
    write_jobs(narrated, [job("a.one", "The first line.")])
    report, _ = render(narrated)
    assert report.deleted == ["b.two"] and voice_files(narrated) == ["a.one.mp3", "a.one.opus"]
    assert list(manifest(narrated)["lines"]) == ["a.one"] and readme.read_text(encoding="utf-8") == "keep"


def test_an_adapter_version_mismatch_is_refused_and_writes_nothing(narrated):
    write_jobs(narrated, [job("a.one", "The first line.")], adapter_version=2)
    with pytest.raises(AudioError, match="adapter_version 2 differs"):
        render(narrated)
    assert voice_files(narrated) == [] and not (narrated / "voice.manifest.json").exists()


def test_a_processed_line_is_on_target_and_under_the_peak_ceiling(narrated):
    write_jobs(narrated, [job("a.one", "A line that is long enough to measure properly, with several words in it.")])
    render(narrated)
    out = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-i", str(narrated.parent / "public/assets/voice/a.one.opus"),
                          "-f", "f32le", "-ac", "1", "-ar", "48000", "-"], capture_output=True).stdout
    decoded = np.frombuffer(out, dtype=np.float32).astype(np.float64)
    assert abs(loudness.integrated(decoded, 48000) - -18.0) < 1.0
    assert loudness.true_peak_db(decoded) <= -1.5 + 0.5      # lossy encoding may overshoot a little
    assert abs(manifest(narrated)["lines"]["a.one"]["durationMs"] - len(decoded) / 48) < 60   # codec padding


def test_a_failing_engine_names_the_line(narrated):
    class Broken(FakeEngine):
        def render(self, job):
            raise AudioError("the model fell over")

    write_jobs(narrated, [job("a.one", "The first line.")])
    with pytest.raises(AudioError, match="line a.one: the model fell over"):
        render(narrated, Broken("chatterbox_turbo"))


def test_the_cli_refuses_a_missing_jobs_file(narrated):
    result = run_cli("voice", "render", "--root", str(narrated))
    assert result.returncode == 1 and "narration.jobs.json" in result.stderr
