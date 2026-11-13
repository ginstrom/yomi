"""Regenerates the fixture project's stand-in sources and impulses.

    uv run --project tools/audio python tools/audio/tests/make_fixture.py

The design's example recipes (fixtures/project/sfx/) name sources that will
come from Kenney, OpenGameArt and Freesound; here each id is a short
synthesised stand-in (licence "own") so the examples parse and render.
"""
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from yomi_audio.impulses import build_impulses
from yomi_audio.sources import add_source

ROOT = Path(__file__).parent / "fixtures" / "project"
SR = 48000
STAND_INS = {  # id: (kind, seconds, seed)
    "rpg_knife_slice_1": ("swish", 0.20, 1),
    "rpg_knife_slice_2": ("swish", 0.18, 2),
    "fs_flesh_hit_3": ("thud", 0.15, 3),
    "oga_hit_flesh_7": ("thud", 0.17, 4),
    "kenney_impact_metal_light_2": ("ring", 0.20, 5),
    "fs_fire_whoosh_1": ("swish", 0.30, 6),
    "fs_fire_whoosh_2": ("swish", 0.28, 7),
    "fs_fire_whoosh_4": ("swish", 0.32, 8),
}
IMPULSES = {
    "small_room": "seed = 1\nlength = 120\nrt60 = 0.1\n",
    "open_air": "seed = 2\nlength = 150\nrt60 = 0.2\ndensity = 0.05\n",
}


def stand_in(kind: str, seconds: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    if kind == "ring":
        x = np.sin(2 * np.pi * (2400 + 300 * seed) * t) * np.exp(-t * 25)
    elif kind == "thud":
        x = np.sin(2 * np.pi * 110 * t) * np.exp(-t * 30) + 0.3 * rng.standard_normal(n) * np.exp(-t * 60)
    else:
        x = rng.standard_normal(n) * np.sin(np.pi * t / seconds) ** 2
    return 0.5 * x / np.max(np.abs(x))


def main() -> int:
    for folder in ("sources", "impulses"):
        shutil.rmtree(ROOT / folder, ignore_errors=True)
    (ROOT / "sources.toml").unlink(missing_ok=True)
    with tempfile.TemporaryDirectory() as scratch:
        for id, spec in STAND_INS.items():
            wav = Path(scratch) / f"{id}.wav"
            sf.write(wav, stand_in(*spec), SR, subtype="FLOAT")
            add_source(ROOT, wav, id=id, collection="stand_in", licence="own",
                       author="yomi-audio tests", url="local", notes="synthesised stand-in")
    (ROOT / "impulses").mkdir()
    for name, text in IMPULSES.items():
        (ROOT / "impulses" / f"{name}.toml").write_text(text)
    build_impulses(ROOT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
