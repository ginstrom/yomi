"""`sources.toml`: every committed source's provenance, and `source add`.

A recipe names sources by id. The registry hands one out only when its licence
is in the allow-list, its file exists and the file's SHA-256 is the one
recorded, so nothing unaccounted for reaches a bank.
"""
import datetime
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from .config import read_toml
from .errors import AudioError

ALLOWED_LICENCES = ("CC0-1.0", "own")
SOURCES_FILE = "sources.toml"
ID_PATTERN = re.compile(r"^[a-z0-9_]+$")
SAMPLE_RATE = 48000
# The order an entry's fields are written in (C4).
FIELD_ORDER = (
    "id", "file", "licence", "author", "url", "original", "original_sha256",
    "excerpt", "sha256", "retrieved", "notes", "design",
)

SOURCES_HEADER = """\
# Every source a sound recipe may name: trimmed CC0 or own excerpts (mono,
# 48 kHz FLAC under sources/), the reverb impulses the tool renders, and later
# the narrator's reference clips. Add one with `yomi-audio source add` (see
# audio/CLAUDE.md), never by hand: it trims, sums to mono, resamples and
# records both hashes.
#
# Fields: id ([a-z0-9_]+, unique), file (relative to audio/), licence, author,
# url (the page the licence is stated on), original (its name in the pack or
# site), original_sha256 (of the downloaded file), excerpt (seconds of the
# original kept), sha256 (of the committed file), retrieved, notes.
#
# Licence allow-list: "CC0-1.0" and "own". The build refuses a recipe naming a
# source that is missing, whose file's SHA-256 differs, or whose licence is
# not allowed.
"""


def sha256_file(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


@dataclass(frozen=True)
class Source:
    id: str
    path: Path
    licence: str
    sha256: str


class Registry:
    def __init__(self, root: Path, entries: list[dict]):
        self.root = Path(root)
        self.entries: dict[str, dict] = {}
        for index, entry in enumerate(entries, start=1):
            for key in ("id", "file", "licence", "sha256"):
                if not isinstance(entry.get(key), str):
                    raise AudioError(f"{SOURCES_FILE}: source {entry.get('id', f'#{index}')}: missing '{key}'")
            if entry["id"] in self.entries:
                raise AudioError(f"{SOURCES_FILE}: source {entry['id']}: listed twice")
            self.entries[entry["id"]] = entry
        self._audio: dict[str, np.ndarray] = {}

    @classmethod
    def load(cls, root: Path) -> "Registry":
        path = Path(root) / SOURCES_FILE
        if not path.exists():
            return cls(root, [])
        return cls(root, read_toml(path).get("source", []))

    def source(self, id: str, context: str) -> Source:
        """The verified source `id`; `context` (the cue) prefixes any error."""
        entry = self.entries.get(id)
        if entry is None:
            raise AudioError(f"{context}: source '{id}' is not in {SOURCES_FILE}")
        if entry["licence"] not in ALLOWED_LICENCES:
            raise AudioError(
                f"{context}: source {id}: licence {entry['licence']} is not allowed "
                f"(allowed: {', '.join(ALLOWED_LICENCES)})"
            )
        path = self.root / entry["file"]
        if not path.exists():
            raise AudioError(f"{context}: source {id}: file {entry['file']} is missing")
        if sha256_file(path) != entry["sha256"]:
            raise AudioError(f"{context}: source {id}: {entry['file']} does not match its recorded SHA-256")
        return Source(id=id, path=path, licence=entry["licence"], sha256=entry["sha256"])

    def audio(self, id: str, context: str, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
        """The source's samples as mono float64, verified first."""
        source = self.source(id, context)
        if id not in self._audio:
            data, sr = sf.read(source.path, dtype="float64", always_2d=True)
            if data.shape[1] != 1:
                raise AudioError(f"{context}: source {id}: must be mono, has {data.shape[1]} channels")
            if sr != sample_rate:
                raise AudioError(f"{context}: source {id}: must be {sample_rate} Hz, is {sr} Hz")
            self._audio[id] = data[:, 0]
        return self._audio[id]


# Writing entries -----------------------------------------------------------------


def _toml_value(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, dict):
        return "{ " + ", ".join(f"{k} = {_toml_value(v)}" for k, v in value.items()) + " }"
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_toml_value(v) for v in value) + "]"
    raise TypeError(f"cannot write {value!r} as TOML")


def entry_toml(entry: dict) -> str:
    keys = [k for k in FIELD_ORDER if k in entry] + [k for k in entry if k not in FIELD_ORDER]
    lines = ["[[source]]"] + [f"{key} = {_toml_value(entry[key])}" for key in keys if entry[key] is not None]
    return "\n".join(lines) + "\n"


def _blocks(text: str) -> tuple[str, list[str]]:
    """Splits sources.toml into its header and one text block per entry."""
    parts = re.split(r"(?m)^(?=\[\[source\]\]\s*$)", text)
    return parts[0], parts[1:]


def upsert_entry(root: Path, entry: dict) -> bool:
    """Writes `entry` in place of the one with its id, or appends it. Returns
    whether the file changed."""
    path = Path(root) / SOURCES_FILE
    text = path.read_text(encoding="utf-8") if path.exists() else SOURCES_HEADER
    header, blocks = _blocks(text)
    new_block = entry_toml(entry)
    for i, block in enumerate(blocks):
        if f'id = {_toml_value(entry["id"])}\n' in block:
            if block.rstrip("\n") == new_block.rstrip("\n"):
                return False
            trailing = block[len(block.rstrip("\n")) :]
            blocks[i] = new_block.rstrip("\n") + (trailing or "\n")
            break
    else:
        if blocks and not blocks[-1].endswith("\n\n"):
            blocks[-1] = blocks[-1].rstrip("\n") + "\n\n"
        elif not blocks and not header.endswith("\n\n"):
            header = header.rstrip("\n") + "\n\n"
        blocks.append(new_block)
    path.write_text(header + "".join(blocks), encoding="utf-8")
    return True


# source add ------------------------------------------------------------------------


def _decode(file: Path) -> tuple[np.ndarray, int]:
    """Any file ffmpeg reads, as float samples (frames x channels)."""
    if shutil.which("ffmpeg") is None:
        raise AudioError("source add: ffmpeg is not on the PATH")
    with tempfile.TemporaryDirectory() as folder:
        wav = Path(folder) / "decoded.wav"
        result = subprocess.run(
            ["ffmpeg", "-nostdin", "-v", "error", "-i", str(file), "-vn", "-c:a", "pcm_f32le", str(wav)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise AudioError(f"source add: ffmpeg could not decode {file.name}: {result.stderr.strip()}")
        data, sr = sf.read(wav, dtype="float64", always_2d=True)
    return data, sr


def add_source(
    root: Path,
    file: Path,
    *,
    id: str,
    collection: str,
    licence: str,
    author: str,
    url: str,
    original: str | None = None,
    start: float | None = None,
    end: float | None = None,
    notes: str | None = None,
    sample_rate: int = SAMPLE_RATE,
) -> dict:
    """Trims `file` to [start, end] seconds, sums it to mono, resamples it to
    `sample_rate`, writes `sources/<collection>/<id>.flac` (24-bit) and appends
    its entry. Checks everything before writing anything."""
    root, file = Path(root), Path(file)
    if licence not in ALLOWED_LICENCES:
        raise AudioError(f"source {id}: licence {licence} is not allowed (allowed: {', '.join(ALLOWED_LICENCES)})")
    if not ID_PATTERN.match(id):
        raise AudioError(f"source {id}: an id must match [a-z0-9_]+")
    if not ID_PATTERN.match(collection):
        raise AudioError(f"source {id}: collection '{collection}' must match [a-z0-9_]+")
    if id in Registry.load(root).entries:
        raise AudioError(f"source {id}: is already in {SOURCES_FILE}")
    if start is not None and start < 0:
        raise AudioError(f"source {id}: start must be 0 or more")
    if start is not None and end is not None and end <= start:
        raise AudioError(f"source {id}: end ({end}) must be after start ({start})")
    if not file.is_file():
        raise AudioError(f"source {id}: {file} does not exist")
    target = root / "sources" / collection / f"{id}.flac"
    if target.exists():
        raise AudioError(f"source {id}: {target.relative_to(root)} already exists")

    data, sr = _decode(file)
    first = int(round((start or 0.0) * sr))
    last = len(data) if end is None else int(round(end * sr))
    if first >= len(data) or last > len(data) + 1:
        raise AudioError(f"source {id}: the excerpt lies outside the file ({len(data) / sr:.3f} s long)")
    mono = data[first:last].mean(axis=1)
    if sr != sample_rate:
        common = gcd(sample_rate, sr)
        mono = resample_poly(mono, sample_rate // common, sr // common)
    mono = np.clip(mono, -1.0, 1.0)

    target.parent.mkdir(parents=True, exist_ok=True)
    sf.write(target, mono, sample_rate, subtype="PCM_24", format="FLAC")
    entry = {
        "id": id,
        "file": target.relative_to(root).as_posix(),
        "licence": licence,
        "author": author,
        "url": url,
        "original": original or file.name,
        "original_sha256": sha256_file(file),
        "excerpt": (
            {"start": float(start or 0.0), "end": float(end if end is not None else len(data) / sr)}
            if start is not None or end is not None
            else None
        ),
        "sha256": sha256_file(target),
        "retrieved": datetime.date.today().isoformat(),
        "notes": notes,
    }
    upsert_entry(root, entry)
    return entry
