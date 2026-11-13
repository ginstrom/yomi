import soundfile as sf
import pytest

from yomi_audio.audition import audition
from yomi_audio.errors import AudioError
from conftest import run_cli


def test_audition_writes_each_variant_and_measures_it(project, tmp_path):
    lines = []
    rows = audition(project, ["ui.click"], out=tmp_path / "out", echo=lines.append)
    assert [r.k for r in rows] == [0, 1, 2, 3]
    for row in rows:
        data, sr = sf.read(row.wav)
        assert sr == 48000 and data.ndim == 1
        assert row.wav.parent == tmp_path / "out"
        assert row.loudness == pytest.approx(-26, abs=0.1) and row.loudness_ok
        assert row.length_ms == pytest.approx(1000 * len(data) / 48000, abs=0.1)
        assert row.peak_ok == (row.true_peak <= -6.0)
        assert row.length_ok == (row.length_ms <= 90)
    text = "\n".join(lines)
    assert "ui.click" in text and "LUFS-M max" in text and "dBTP" in text


def test_default_folder_is_under_the_root(project):
    rows = audition(project, ["ui.click"], echo=lambda *_: None)
    assert rows[0].wav.parent == project / ".audition" / "ui.click"


def test_spectrograms_are_written(project, tmp_path):
    rows = audition(project, ["battle.impact.fireball"], out=tmp_path, spectrogram=True, echo=lambda *_: None)
    for row in rows:
        assert row.png is not None and row.png.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"


def test_several_cues_get_a_folder_each_under_out(project, tmp_path):
    rows = audition(project, ["ui.click", "battle.hit.slash"], out=tmp_path, echo=lambda *_: None)
    assert {r.wav.parent.name for r in rows} == {"ui.click", "battle.hit.slash"}


def test_an_unknown_cue_is_named(project):
    with pytest.raises(AudioError, match="ui.nothing"):
        audition(project, ["ui.nothing"], echo=lambda *_: None)


def test_cli_audition(project, tmp_path):
    result = run_cli("sfx", "audition", "ui.click", "--out", str(tmp_path), "--root", str(project))
    assert result.returncode == 0, result.stderr
    assert "ui.click" in result.stdout
    assert len(list(tmp_path.glob("*.wav"))) == 4


def test_cli_names_a_bad_recipe_in_one_line(project):
    (project / "sfx" / "ui" / "bad.toml").write_text('variants = 1\nseed = 1\ngroup = "ui"\n[[layer]]\nvolume = 2\nsource = "x"\n')
    result = run_cli("sfx", "audition", "ui.bad", "--root", str(project))
    assert result.returncode == 1
    assert result.stderr.strip() == "yomi-audio: ui.bad: layer 1: unknown field 'volume'"
