import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

TESTS = Path(__file__).parent
FIXTURE = TESTS / "fixtures" / "project"
SR = 48000


@pytest.fixture
def project(tmp_path) -> Path:
    """A copy of the fixture project, safe to write to."""
    root = tmp_path / "audio"
    shutil.copytree(FIXTURE, root, ignore=shutil.ignore_patterns(".audition"))
    return root


@pytest.fixture
def empty_project(tmp_path) -> Path:
    """A project with the fixture's audio.toml and no sources."""
    root = tmp_path / "empty"
    root.mkdir()
    shutil.copy(FIXTURE / "audio.toml", root / "audio.toml")
    return root


def write_wav(path: Path, x: np.ndarray, sr: int = SR) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(path, x, sr, subtype="FLOAT")
    return path


def run_cli(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "yomi_audio", *args],
        capture_output=True,
        text=True,
        cwd=cwd,
    )
