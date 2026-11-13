"""`audio.toml`: the build's settings, and where the project root is."""
import tomllib
from dataclasses import dataclass
from pathlib import Path

from .errors import AudioError
from .loudness import MEASURES

CONFIG_FILE = "audio.toml"


def default_root() -> Path:
    """The repository's `audio/`: beside `tools/` when the package runs from the
    checkout (uv installs it editable), else the nearest `audio/audio.toml`
    above the working directory."""
    checkout = Path(__file__).resolve().parents[3] / "audio"
    if (checkout / CONFIG_FILE).exists():
        return checkout
    for folder in [Path.cwd(), *Path.cwd().parents]:
        if (folder / "audio" / CONFIG_FILE).exists():
            return folder / "audio"
    return checkout


@dataclass(frozen=True)
class Group:
    name: str
    measure: str
    target: float
    tolerance: float
    peak: float


@dataclass(frozen=True)
class Config:
    root: Path
    sample_rate: int
    gap_ms: float
    banks: tuple[str, ...]
    budgets: dict
    groups: dict[str, Group]
    encode: dict
    voice: dict


def read_toml(path: Path, what: str | None = None) -> dict:
    what = what or path.name
    if not path.exists():
        raise AudioError(f"{what}: not found at {path}")
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as error:
        raise AudioError(f"{what}: invalid TOML: {error}") from None


def _number(table: dict, key: str, where: str) -> float:
    value = table.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise AudioError(f"{CONFIG_FILE}: {where}.{key} must be a number")
    return value


def load_config(root: Path) -> Config:
    root = Path(root)
    data = read_toml(root / CONFIG_FILE, CONFIG_FILE)
    groups = {}
    for name, table in data.get("groups", {}).items():
        where = f"groups.{name}"
        measure = table.get("measure")
        if measure not in MEASURES:
            raise AudioError(f"{CONFIG_FILE}: {where}.measure must be one of {', '.join(MEASURES)}, not {measure!r}")
        groups[name] = Group(
            name=name,
            measure=measure,
            target=_number(table, "target", where),
            tolerance=_number(table, "tolerance", where),
            peak=_number(table, "peak", where),
        )
    sample_rate = data.get("sample_rate")
    if not isinstance(sample_rate, int) or sample_rate <= 0:
        raise AudioError(f"{CONFIG_FILE}: sample_rate must be a positive integer")
    return Config(
        root=root,
        sample_rate=sample_rate,
        gap_ms=data.get("gap_ms", 50),
        banks=tuple(data.get("banks", ())),
        budgets=dict(data.get("budgets", {})),
        groups=groups,
        encode=dict(data.get("encode", {})),
        voice=dict(data.get("voice", {})),
    )
