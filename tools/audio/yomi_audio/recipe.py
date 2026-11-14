"""Sound recipes: parse, validate, resolve a variant, render it.

A recipe is `sfx/<bank>/<name>.toml` for the cue `<bank>.<name>` (the format
is design §5.6). Rendering variant `k`:

1. Resolve: a generator seeded from `(seed, k)` draws every `[lo, hi]` range,
   layer by layer in file order and, within a layer, field by field in the
   fixed orders below (not the order the file writes them in), then the post
   chain's. A `chance` is drawn in its place. A `pick` takes the k-th entry of
   a run of shuffles of its list, one shuffle per pass through it, seeded
   from the recipe's seed and the layer alone, so every listed source is used
   before any repeats. Variant k therefore depends on nothing but the recipe
   and k.
2. Each included layer: its source or synth (noise and crackle draw from a
   generator of their own, seeded from `(seed, k, layer)`), trimmed by
   `start`/`length`, reversed, pitched, filtered, saturated, enveloped,
   faded in and out, gained, then placed at `offset`.
3. The mix runs through `[post] chain`, then is normalised to the group's
   loudness target, always last; where that gain would put the true peak
   over the group's ceiling, the gain that meets the ceiling is used instead
   (the lesser of the two), so the ceiling always holds.

Every source the recipe names is verified before anything renders, even one
only a left-out layer or an unpicked `pick` entry names.
"""
import re
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import dsp, synth
from .config import Config, Group
from .errors import AudioError
from .loudness import normalise
from .sources import IMPULSE_PREFIX, Registry

NUM, BOOL, STR = "num", "bool", "str"

TOP_FIELDS = ("variants", "seed", "group", "max_ms", "layer", "post")

# Layer fields in the order their ranges are drawn.
LAYER_FIELDS = {
    "chance": NUM,
    "source": STR,
    "pick": "pick",
    "synth": "synth",
    "start": NUM,
    "length": NUM,
    "reverse": BOOL,
    "pitch": NUM,
    "filter": "filters",
    "saturate": NUM,
    "envelope": "envelope",
    "fade_in": NUM,
    "fade_out": NUM,
    "gain": NUM,
    "offset": NUM,
}
ORIGINS = ("source", "pick", "synth")

SYNTH_FIELDS = {
    "kind": STR, "length": NUM, "hz": NUM, "hz_end": NUM, "curve": STR, "color": STR,
    "carrier_hz": NUM, "ratio": NUM, "index": NUM, "index_end": NUM, "density": NUM, "click_ms": NUM,
}
_OSCILLATOR = ({"hz"}, {"hz_end", "curve"})
SYNTH_KINDS = {
    "sine": _OSCILLATOR,
    "triangle": _OSCILLATOR,
    "saw": _OSCILLATOR,
    "square": _OSCILLATOR,
    "noise": (set(), {"color"}),
    "fm": ({"carrier_hz"}, {"ratio", "index", "index_end"}),
    "crackle": ({"density"}, {"click_ms"}),
    "impulse": (set(), set()),
}
ENUMS = {"curve": synth.CURVES, "color": synth.COLOURS}

FILTER_FIELDS = {"hz": NUM, "hz_end": NUM, "q": NUM, "gain_db": NUM}
_PASS = ({"hz"}, {"q", "hz_end"})
_GAIN = ({"hz", "gain_db"}, {"q"})
FILTER_TYPES = {
    "highpass": _PASS, "lowpass": _PASS, "bandpass": _PASS,
    "peak": _GAIN, "lowshelf": _GAIN, "highshelf": _GAIN,
}

POST_FIELDS = {
    "threshold_db": NUM, "ratio": NUM, "attack_ms": NUM, "release_ms": NUM, "drive_db": NUM,
    "impulse": STR, "wet_db": NUM, "predelay_ms": NUM, "ms": NUM, "feedback": NUM,
    "ceiling_db": NUM, "keep_tail_ms": NUM,
}
POST_TYPES = {
    "compress": ({"threshold_db", "ratio"}, {"attack_ms", "release_ms"}),
    "saturate": ({"drive_db"}, set()),
    "reverb": ({"impulse"}, {"wet_db", "predelay_ms"}),
    "delay": ({"ms"}, {"feedback", "wet_db"}),
    "limit": ({"ceiling_db"}, {"release_ms"}),
    "trim": (set(), {"threshold_db", "keep_tail_ms"}),
    "fade_out": ({"ms"}, set()),
}
POSITIVE = {"length", "hz", "hz_end", "carrier_hz", "q", "density", "click_ms", "ms", "ratio"}

CUE_PATTERN = re.compile(r"^([a-z0-9_]+)\.([a-z0-9_]+(?:\.[a-z0-9_]+)*)$")
PICK_STREAM = 0x5049434B  # streams apart from the variant's own (seed, k)
SIGNAL_STREAM = 0x5349474E


def impulse_source_id(name: str) -> str:
    return IMPULSE_PREFIX + name


def cue_path(root: Path, cue: str) -> Path:
    match = CUE_PATTERN.match(cue)
    if not match:
        raise AudioError(f"cue '{cue}': must be <bank>.<name>, lower case letters, digits and _")
    return Path(root) / "sfx" / match.group(1) / f"{match.group(2)}.toml"


@dataclass(frozen=True)
class Recipe:
    cue: str
    variants: int
    seed: int
    group: Group
    max_ms: float | None
    layers: list[dict]
    post: list[dict]
    text: str = field(repr=False, default="")

    def source_ids(self) -> list[str]:
        """Every source and impulse id the recipe can touch, in order."""
        ids = []
        for layer in self.layers:
            ids += [layer["source"]] if "source" in layer else layer.get("pick", [])
        ids += [impulse_source_id(step["impulse"]) for step in self.post if step["type"] == "reverb"]
        return list(dict.fromkeys(ids))


@dataclass(frozen=True)
class Variant:
    k: int
    layers: list[dict]
    post: list[dict]


# Validation ----------------------------------------------------------------------


def _check_number(value, where: str, name: str):
    if isinstance(value, bool) or not isinstance(value, (int, float, list)):
        raise AudioError(f"{where}: {name}: must be a number or [lo, hi]")
    if isinstance(value, list):
        if (
            len(value) != 2
            or any(isinstance(v, bool) or not isinstance(v, (int, float)) for v in value)
            or value[0] > value[1]
        ):
            raise AudioError(f"{where}: {name}: a range must be [lo, hi] with lo <= hi")
        lowest = value[0]
    else:
        lowest = value
    if name in POSITIVE and lowest <= 0:
        raise AudioError(f"{where}: {name}: must be above 0")


def _check_value(kind: str, value, where: str, name: str):
    if kind == NUM:
        _check_number(value, where, name)
    elif kind == BOOL and not isinstance(value, bool):
        raise AudioError(f"{where}: {name}: must be true or false")
    elif kind == STR:
        if not isinstance(value, str):
            raise AudioError(f"{where}: {name}: must be a string")
        if name in ENUMS and value not in ENUMS[name]:
            raise AudioError(f"{where}: {name}: must be one of {', '.join(ENUMS[name])}")


def _check_table(table, fields: dict, types: dict, where: str, label: str):
    """A typed table (a synth, a filter, a post step): its kind, then exactly
    the fields that kind takes."""
    if not isinstance(table, dict):
        raise AudioError(f"{where}: must be a table")
    kind = table.get(label)
    if kind not in types:
        raise AudioError(f"{where}: unknown {label} {kind!r}" if kind is None else f"{where}: unknown {label} '{kind}'")
    required, optional = types[kind]
    allowed = required | optional | {label}
    if label == "kind":
        allowed |= {"length"}
        required = required | {"length"}
    for name in table:
        if name not in allowed:
            suffix = f" for {label} '{kind}'" if name in fields else ""
            raise AudioError(f"{where}: unknown field '{name}'{suffix}")
    for name in sorted(required):
        if name not in table:
            raise AudioError(f"{where}: missing '{name}'")
    for name, value in table.items():
        if name != label:
            _check_value(fields[name], value, where, name)


def _check_envelope(points, where: str):
    if not isinstance(points, list) or not points:
        raise AudioError(f"{where}: envelope: must be a list of [ms, dB] points")
    for i, point in enumerate(points, start=1):
        if not isinstance(point, list) or len(point) != 2:
            raise AudioError(f"{where}: envelope: point {i} must be [ms, dB]")
        _check_number(point[0], where, f"envelope point {i} ms")
        _check_number(point[1], where, f"envelope point {i} dB")


def _check_layer(layer, where: str):
    if not isinstance(layer, dict):
        raise AudioError(f"{where}: must be a table")
    for name in layer:
        if name not in LAYER_FIELDS:
            raise AudioError(f"{where}: unknown field '{name}'")
    origins = [name for name in ORIGINS if name in layer]
    if not origins:
        raise AudioError(f"{where}: needs one of source, pick or synth")
    if len(origins) > 1:
        raise AudioError(f"{where}: has more than one of source, pick and synth")
    for name, value in layer.items():
        kind = LAYER_FIELDS[name]
        if kind == "pick":
            if not isinstance(value, list) or not value or not all(isinstance(v, str) for v in value):
                raise AudioError(f"{where}: pick: must be a non-empty list of source ids")
        elif kind == "synth":
            _check_table(value, SYNTH_FIELDS, SYNTH_KINDS, f"{where}: synth", "kind")
        elif kind == "filters":
            if not isinstance(value, list):
                raise AudioError(f"{where}: filter: must be a list of tables")
            for i, spec in enumerate(value, start=1):
                _check_table(spec, FILTER_FIELDS, FILTER_TYPES, f"{where}: filter {i}", "type")
        elif kind == "envelope":
            _check_envelope(value, where)
        else:
            _check_value(kind, value, where, name)
    chance = layer.get("chance")
    if chance is not None:
        values = chance if isinstance(chance, list) else [chance]
        if any(not 0 <= v <= 1 for v in values):
            raise AudioError(f"{where}: chance: must lie between 0 and 1")


def parse_recipe(text: str, cue: str, groups: dict[str, Group]) -> Recipe:
    try:
        data = tomllib.loads(text)
    except tomllib.TOMLDecodeError as error:
        raise AudioError(f"{cue}: invalid TOML: {error}") from None
    for name in data:
        if name not in TOP_FIELDS:
            raise AudioError(f"{cue}: unknown field '{name}'")
    for name in ("variants", "seed", "group"):
        if name not in data:
            raise AudioError(f"{cue}: missing '{name}'")
    variants, seed = data["variants"], data["seed"]
    if isinstance(variants, bool) or not isinstance(variants, int) or variants < 1:
        raise AudioError(f"{cue}: variants: must be a whole number, 1 or more")
    if isinstance(seed, bool) or not isinstance(seed, int) or seed < 0:
        raise AudioError(f"{cue}: seed: must be a whole number, 0 or more")
    group = groups.get(data["group"]) if isinstance(data["group"], str) else None
    if group is None:
        raise AudioError(f"{cue}: group '{data['group']}' is not in audio.toml")
    max_ms = data.get("max_ms")
    if max_ms is not None and (isinstance(max_ms, bool) or not isinstance(max_ms, (int, float)) or max_ms <= 0):
        raise AudioError(f"{cue}: max_ms: must be a number above 0")
    layers = data.get("layer", [])
    if not isinstance(layers, list) or not layers:
        raise AudioError(f"{cue}: has no [[layer]]")
    for i, layer in enumerate(layers, start=1):
        _check_layer(layer, f"{cue}: layer {i}")
    post = data.get("post", {})
    if not isinstance(post, dict):
        raise AudioError(f"{cue}: post: must be a table")
    for name in post:
        if name != "chain":
            raise AudioError(f"{cue}: post: unknown field '{name}'")
    chain = post.get("chain", [])
    if not isinstance(chain, list):
        raise AudioError(f"{cue}: post: chain must be a list of tables")
    for i, step in enumerate(chain, start=1):
        _check_table(step, POST_FIELDS, POST_TYPES, f"{cue}: post {i}", "type")
    return Recipe(cue=cue, variants=variants, seed=seed, group=group, max_ms=max_ms, layers=layers, post=chain, text=text)


def load_recipe(config: Config, cue: str) -> Recipe:
    path = cue_path(config.root, cue)
    bank = cue.split(".", 1)[0]
    if config.banks and bank not in config.banks:
        raise AudioError(f"cue '{cue}': bank '{bank}' is not in audio.toml")
    if not path.exists():
        raise AudioError(f"cue '{cue}': no recipe at {path.relative_to(config.root)}")
    return parse_recipe(path.read_text(encoding="utf-8"), cue, config.groups)


# Resolution ------------------------------------------------------------------------


def _draw(value, rng: np.random.Generator):
    if isinstance(value, list):
        return float(rng.uniform(value[0], value[1]))
    return value


def _draw_table(table: dict, order, rng) -> dict:
    out = {name: table[name] for name in table if name not in order}
    for name in order:
        if name in table:
            out[name] = _draw(table[name], rng)
    return out


def _pick(recipe: Recipe, layer_index: int, ids: list[str], k: int) -> str:
    round_, position = divmod(k, len(ids))
    shuffle = np.random.default_rng([recipe.seed, PICK_STREAM, layer_index, round_]).permutation(len(ids))
    return ids[int(shuffle[position])]


def resolve(recipe: Recipe, k: int) -> Variant:
    """Variant k with every range drawn and every pick and chance decided."""
    rng = np.random.default_rng([recipe.seed, k])
    layers = []
    for index, layer in enumerate(recipe.layers):
        out = {}
        for name in LAYER_FIELDS:
            if name not in layer:
                continue
            value = layer[name]
            if name == "chance":
                out["included"] = bool(rng.random() < _draw(value, rng))
            elif name == "pick":
                out["source"] = _pick(recipe, index, value, k)
            elif name == "synth":
                out["synth"] = _draw_table(value, SYNTH_FIELDS, rng)
            elif name == "filter":
                out["filter"] = [_draw_table(spec, FILTER_FIELDS, rng) for spec in value]
            elif name == "envelope":
                out["envelope"] = [[_draw(ms, rng), _draw(db, rng)] for ms, db in value]
            else:
                out[name] = _draw(value, rng)
        out.setdefault("included", True)
        layers.append(out)
    post = [_draw_table(step, POST_FIELDS, rng) for step in recipe.post]
    return Variant(k=k, layers=layers, post=post)


# Rendering -------------------------------------------------------------------------


def _layer_audio(recipe: Recipe, k: int, index: int, layer: dict, registry: Registry, sr: int) -> np.ndarray:
    where = f"{recipe.cue}#{k}: layer {index + 1}"
    if "synth" in layer:
        rng = np.random.default_rng([recipe.seed, k, index, SIGNAL_STREAM])
        x = synth.render(layer["synth"], sr, rng)
    else:
        x = registry.audio(layer["source"], recipe.cue, sr)
    start = dsp.samples(layer.get("start", 0.0), sr)
    x = x[start:]
    if "length" in layer:
        x = x[: dsp.samples(layer["length"], sr)]
    if layer.get("reverse"):
        x = x[::-1]
    x = dsp.pitch_shift(np.array(x, dtype=np.float64), layer.get("pitch", 0.0))
    for spec in layer.get("filter", []):
        x = dsp.apply_filter(x, sr, spec)
    if "saturate" in layer:
        x = dsp.saturate(x, layer["saturate"])
    if "envelope" in layer:
        times = [ms for ms, _ in layer["envelope"]]
        if times != sorted(times):
            raise AudioError(f"{where}: envelope: its points' times must not go backwards")
        x = dsp.apply_envelope(x, sr, layer["envelope"])
    if "fade_in" in layer:
        x = dsp.fade_in(x, sr, layer["fade_in"])
    if "fade_out" in layer:
        x = dsp.fade_out(x, sr, layer["fade_out"])
    return x * dsp.db2lin(layer.get("gain", 0.0))


def _post(recipe: Recipe, step: dict, x: np.ndarray, registry: Registry, sr: int) -> np.ndarray:
    kind = step["type"]
    if kind == "compress":
        return dsp.compress(
            x, sr, step["threshold_db"], step["ratio"], step.get("attack_ms", 5.0), step.get("release_ms", 50.0)
        )
    if kind == "saturate":
        return dsp.saturate(x, step["drive_db"])
    if kind == "reverb":
        ir = registry.audio(impulse_source_id(step["impulse"]), recipe.cue, sr)
        return dsp.reverb(x, sr, ir, step.get("wet_db", -12.0), step.get("predelay_ms", 0.0))
    if kind == "delay":
        return dsp.delay(x, sr, step["ms"], step.get("feedback", 0.3), step.get("wet_db", -12.0))
    if kind == "limit":
        return dsp.limit(x, sr, step["ceiling_db"], step.get("release_ms", 50.0))
    if kind == "trim":
        return dsp.trim(x, sr, step.get("threshold_db", -60.0), step.get("keep_tail_ms", 20.0))
    if kind == "fade_out":
        return dsp.fade_out(x, sr, step["ms"])
    raise AudioError(f"{recipe.cue}: unknown post step '{kind}'")


def render_variant(recipe: Recipe, k: int, registry: Registry, sr: int) -> np.ndarray:
    """Variant k as mono float64 PCM at `sr`, normalised to its group: to its
    loudness target, or less where the true-peak ceiling binds first."""
    verify_sources(recipe, registry)
    variant = resolve(recipe, k)
    placed = []
    for index, layer in enumerate(variant.layers):
        if layer["included"]:
            x = _layer_audio(recipe, k, index, layer, registry, sr)
            placed.append((dsp.samples(layer.get("offset", 0.0), sr), x))
    if not placed:
        raise AudioError(f"{recipe.cue}#{k}: every layer was left out by its chance")
    mix = np.zeros(max(offset + len(x) for offset, x in placed))
    for offset, x in placed:
        mix[offset : offset + len(x)] += x
    for step in variant.post:
        mix = _post(recipe, step, mix, registry, sr)
    group = recipe.group
    return normalise(mix, sr, group.measure, group.target, what=f"{recipe.cue}#{k}", peak_ceiling=group.peak)


def verify_sources(recipe: Recipe, registry: Registry) -> None:
    """Every source and impulse the recipe names, drawn into a variant or
    not, is registered, allowed and unchanged."""
    for id in recipe.source_ids():
        registry.source(id, recipe.cue)


def render(recipe: Recipe, registry: Registry, sr: int) -> list[np.ndarray]:
    return [render_variant(recipe, k, registry, sr) for k in range(recipe.variants)]
