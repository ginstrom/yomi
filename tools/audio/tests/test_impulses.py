import tomllib

import numpy as np
import pytest
import soundfile as sf

from yomi_audio.errors import AudioError
from yomi_audio.impulses import build_impulses
from yomi_audio.sources import Registry, sha256_file
from conftest import run_cli

ROOM = """
seed = 4
length = 300
rt60 = 0.25
filter = [{ type = "lowpass", hz = 8000, hz_end = 3000 }, { type = "highpass", hz = 120 }]
"""
SPARSE = """
seed = 5
length = 200
rt60 = 0.5
density = 0.02
"""


def impulse_project(empty_project, **recipes):
    folder = empty_project / "impulses"
    folder.mkdir()
    for name, text in recipes.items():
        (folder / f"{name}.toml").write_text(text)
    return empty_project


def test_build_renders_registers_and_is_stable(empty_project):
    root = impulse_project(empty_project, room=ROOM, sparse=SPARSE)
    results = build_impulses(root)
    assert [(p.name, changed) for p, changed in results] == [("room.flac", True), ("sparse.flac", True)]
    data, sr = sf.read(root / "impulses" / "room.flac")
    assert sr == 48000 and data.ndim == 1 and len(data) == int(0.3 * 48000)
    assert np.max(np.abs(data)) == pytest.approx(10 ** (-1 / 20), abs=1e-3)
    early, late = np.abs(data[:2000]).mean(), np.abs(data[-2000:]).mean()
    assert late < early / 20
    entries = {e["id"]: e for e in tomllib.loads((root / "sources.toml").read_text())["source"]}
    room = entries["impulse_room"]
    assert room["licence"] == "own" and room["file"] == "impulses/room.flac"
    assert room["sha256"] == sha256_file(root / "impulses" / "room.flac")
    Registry.load(root).audio("impulse_room", "test")  # verifies
    sparse, _ = sf.read(root / "impulses" / "sparse.flac")
    assert np.count_nonzero(np.abs(sparse) > 1e-4) < 0.1 * len(sparse)

    text, hashes = (root / "sources.toml").read_text(), room["sha256"]
    again = build_impulses(root)
    assert [changed for _, changed in again] == [False, False]
    assert (root / "sources.toml").read_text() == text
    assert sha256_file(root / "impulses" / "room.flac") == hashes


def test_a_changed_recipe_rewrites_its_entry(empty_project):
    root = impulse_project(empty_project, room=ROOM)
    build_impulses(root)
    (root / "impulses" / "room.toml").write_text(ROOM.replace("seed = 4", "seed = 9"))
    [(_, changed)] = build_impulses(root)
    assert changed
    entries = tomllib.loads((root / "sources.toml").read_text())["source"]
    assert len(entries) == 1 and entries[0]["sha256"] == sha256_file(root / "impulses" / "room.flac")


def test_only_the_named_impulses_are_built(empty_project):
    root = impulse_project(empty_project, room=ROOM, sparse=SPARSE)
    assert [p.name for p, _ in build_impulses(root, ["sparse"])] == ["sparse.flac"]
    with pytest.raises(AudioError, match="hall"):
        build_impulses(root, ["hall"])


@pytest.mark.parametrize(
    "text, message",
    [
        (ROOM.replace("rt60 = 0.25", ""), r"impulse room: missing 'rt60'"),
        (ROOM + "wet = 1\n", r"impulse room: unknown field 'wet'"),
        (ROOM.replace('"lowpass"', '"comb"'), r"impulse room: filter 1: unknown type 'comb'"),
        (ROOM.replace("rt60 = 0.25", "rt60 = -1"), r"impulse room: rt60"),
    ],
)
def test_mistakes_name_the_impulse(empty_project, text, message):
    root = impulse_project(empty_project, room=text)
    with pytest.raises(AudioError, match=message):
        build_impulses(root)


def test_cli_builds(empty_project):
    root = impulse_project(empty_project, room=ROOM)
    result = run_cli("impulse", "build", "--root", str(root))
    assert result.returncode == 0, result.stderr
    assert "impulses/room.flac" in result.stdout
