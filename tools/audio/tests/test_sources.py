import hashlib
import tomllib

import numpy as np
import pytest
import soundfile as sf

from yomi_audio.errors import AudioError
from yomi_audio.sources import Registry, add_source
from conftest import SR, run_cli, write_wav


def tone(seconds=0.5, hz=440.0, sr=SR, channels=1):
    t = np.arange(int(seconds * sr)) / sr
    x = 0.5 * np.sin(2 * np.pi * hz * t)
    return np.stack([x] * channels, axis=1) if channels > 1 else x


def entries(root):
    path = root / "sources.toml"
    return tomllib.loads(path.read_text())["source"] if path.exists() else []


def add(root, file, **overrides):
    args = dict(id="test_tone", collection="test", licence="own", author="me", url="local")
    args.update(overrides)
    return add_source(root, file, **args)


def test_add_writes_mono_48k_flac_and_an_entry_with_both_hashes(empty_project, tmp_path):
    original = write_wav(tmp_path / "in" / "stereo.wav", tone(1.0, channels=2, sr=44100), sr=44100)
    add(empty_project, original, start=0.25, end=0.75, notes="a test")
    flac = empty_project / "sources" / "test" / "test_tone.flac"
    data, sr = sf.read(flac)
    assert sr == 48000 and data.ndim == 1
    assert len(data) == pytest.approx(0.5 * 48000, abs=2)
    assert sf.info(flac).subtype == "PCM_24"
    [entry] = entries(empty_project)
    assert entry["id"] == "test_tone"
    assert entry["file"] == "sources/test/test_tone.flac"
    assert entry["licence"] == "own"
    assert entry["original"] == "stereo.wav"
    assert entry["excerpt"] == {"start": 0.25, "end": 0.75}
    assert entry["sha256"] == hashlib.sha256(flac.read_bytes()).hexdigest()
    assert entry["original_sha256"] == hashlib.sha256(original.read_bytes()).hexdigest()
    assert len(entry["retrieved"]) == 10 and entry["notes"] == "a test"


def test_add_appends_and_keeps_the_header(empty_project, tmp_path):
    original = write_wav(tmp_path / "a.wav", tone())
    add(empty_project, original, id="one")
    add(empty_project, original, id="two", original="Audio/two.ogg")
    assert [e["id"] for e in entries(empty_project)] == ["one", "two"]
    assert entries(empty_project)[1]["original"] == "Audio/two.ogg"
    assert (empty_project / "sources.toml").read_text().startswith("#")


@pytest.mark.parametrize(
    "overrides, message",
    [
        ({"licence": "CC-BY-4.0"}, "CC-BY-4.0"),
        ({"id": "Bad-Id"}, "Bad-Id"),
        ({"collection": "../up"}, "collection"),
        ({"start": 0.4, "end": 0.2}, "end"),
    ],
)
def test_add_refuses_and_writes_nothing(empty_project, tmp_path, overrides, message):
    original = write_wav(tmp_path / "a.wav", tone())
    with pytest.raises(AudioError, match=message):
        add(empty_project, original, **overrides)
    assert not (empty_project / "sources").exists()
    assert entries(empty_project) == []


def test_add_refuses_a_duplicate_id(empty_project, tmp_path):
    original = write_wav(tmp_path / "a.wav", tone())
    add(empty_project, original)
    before = (empty_project / "sources.toml").read_text()
    with pytest.raises(AudioError, match="test_tone.*already"):
        add(empty_project, original, collection="other")
    assert (empty_project / "sources.toml").read_text() == before
    assert not (empty_project / "sources" / "other").exists()


def test_add_refuses_a_missing_file(empty_project, tmp_path):
    with pytest.raises(AudioError, match="nothing.wav"):
        add(empty_project, tmp_path / "nothing.wav")


def test_cli_refuses_a_disallowed_licence_with_one_line(empty_project, tmp_path):
    original = write_wav(tmp_path / "a.wav", tone())
    result = run_cli(
        "source", "add", str(original), "--id", "x", "--collection", "test", "--licence", "CC-BY-4.0",
        "--author", "me", "--url", "local", "--root", str(empty_project),
    )
    assert result.returncode != 0
    assert "CC-BY-4.0" in result.stderr and "Traceback" not in result.stderr
    assert not (empty_project / "sources.toml").exists() or entries(empty_project) == []
    assert not (empty_project / "sources").exists()


def test_cli_adds(empty_project, tmp_path):
    original = write_wav(tmp_path / "a.wav", tone())
    result = run_cli(
        "source", "add", str(original), "--id", "test_tone", "--collection", "test", "--licence", "own",
        "--author", "me", "--url", "local", "--root", str(empty_project),
    )
    assert result.returncode == 0, result.stderr
    assert [e["id"] for e in entries(empty_project)] == ["test_tone"]


# The registry, as a recipe uses it -----------------------------------------------------


def registered(project, tmp_path):
    add(project, write_wav(tmp_path / "a.wav", tone()))
    return Registry.load(project)


def test_registry_loads_a_source_as_float_pcm(empty_project, tmp_path):
    x = registered(empty_project, tmp_path).audio("test_tone", "battle.x")
    assert x.dtype == np.float64 and x.ndim == 1 and len(x) == SR // 2


def test_registry_refuses_an_unknown_id_naming_the_cue(empty_project, tmp_path):
    with pytest.raises(AudioError, match="battle.x.*nope"):
        registered(empty_project, tmp_path).audio("nope", "battle.x")


def test_registry_refuses_a_changed_file(empty_project, tmp_path):
    registry = registered(empty_project, tmp_path)
    flac = empty_project / "sources" / "test" / "test_tone.flac"
    sf.write(flac, tone(0.4), SR, subtype="PCM_24")
    with pytest.raises(AudioError, match="test_tone.*SHA-256"):
        Registry.load(empty_project).audio("test_tone", "battle.x")


def test_registry_refuses_a_missing_file(empty_project, tmp_path):
    registered(empty_project, tmp_path)
    (empty_project / "sources" / "test" / "test_tone.flac").unlink()
    with pytest.raises(AudioError, match="test_tone.*missing"):
        Registry.load(empty_project).audio("test_tone", "battle.x")


def test_registry_refuses_a_disallowed_licence(empty_project, tmp_path):
    registered(empty_project, tmp_path)
    path = empty_project / "sources.toml"
    path.write_text(path.read_text().replace('licence = "own"', 'licence = "CC-BY-4.0"'))
    with pytest.raises(AudioError, match="test_tone.*CC-BY-4.0"):
        Registry.load(empty_project).audio("test_tone", "battle.x")


def test_registry_refuses_duplicate_ids(empty_project, tmp_path):
    registered(empty_project, tmp_path)
    path = empty_project / "sources.toml"
    text = path.read_text()
    path.write_text(text + text[text.index("[[source]]") :])
    with pytest.raises(AudioError, match="test_tone.*twice"):
        Registry.load(empty_project)


@pytest.mark.parametrize("end", ["-0.2", "0"])
def test_cli_refuses_an_end_that_is_not_after_the_start_of_the_file(empty_project, tmp_path, end):
    original = write_wav(tmp_path / "in.wav", tone())
    result = run_cli(
        "source", "add", str(original), "--id", "x", "--collection", "test", "--licence", "own",
        "--author", "me", "--url", "local", "--end", end, "--root", str(empty_project),
    )
    assert result.returncode == 1
    assert "Traceback" not in result.stderr
    assert result.stderr.count("\n") == 1 and "source x" in result.stderr


def test_cli_reports_an_unexpected_failure_in_one_line(monkeypatch, capsys):
    from yomi_audio import cli

    def broken(args):
        raise ValueError("something deep went wrong")

    monkeypatch.setattr(cli, "_impulse_build", broken)
    assert cli.main(["impulse", "build", "--root", "."]) == 1
    err = capsys.readouterr().err
    assert err.count("\n") == 1
    assert "something deep went wrong" in err and "ValueError" in err
