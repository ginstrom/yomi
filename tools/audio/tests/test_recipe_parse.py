import textwrap

import pytest

from yomi_audio.config import load_config
from yomi_audio.errors import AudioError
from yomi_audio.recipe import cue_path, parse_recipe, resolve
from conftest import FIXTURE

GROUPS = load_config(FIXTURE).groups
EXAMPLES = {
    "battle.hit.slash": FIXTURE / "sfx" / "battle" / "hit.slash.toml",
    "battle.impact.fireball": FIXTURE / "sfx" / "battle" / "impact.fireball.toml",
    "ui.click": FIXTURE / "sfx" / "ui" / "click.toml",
}


def parse(text, cue="battle.x"):
    return parse_recipe(textwrap.dedent(text), cue, GROUPS)


BASE = """
variants = 4
seed = 1
group = "impact"
"""


def test_cue_path_follows_the_bank_and_name(tmp_path):
    assert cue_path(tmp_path, "world.rune.embed") == tmp_path / "sfx" / "world" / "rune.embed.toml"
    assert cue_path(tmp_path, "ui.click") == tmp_path / "sfx" / "ui" / "click.toml"
    with pytest.raises(AudioError, match="Bad"):
        cue_path(tmp_path, "Bad")
    with pytest.raises(AudioError, match="nobank"):
        cue_path(tmp_path, "nobank")


@pytest.mark.parametrize("cue, path", EXAMPLES.items())
def test_the_design_examples_parse(cue, path):
    recipe = parse_recipe(path.read_text(), cue, GROUPS)
    assert recipe.cue == cue
    assert recipe.variants >= 1 and recipe.layers


def test_the_examples_name_their_sources_and_impulses():
    recipe = parse_recipe(EXAMPLES["battle.hit.slash"].read_text(), "battle.hit.slash", GROUPS)
    assert recipe.source_ids() == [
        "rpg_knife_slice_1", "rpg_knife_slice_2", "fs_flesh_hit_3", "oga_hit_flesh_7",
        "kenney_impact_metal_light_2", "impulse_small_room",
    ]


@pytest.mark.parametrize(
    "text, message",
    [
        (BASE + "colour = 1\n", r"battle\.x: unknown field 'colour'"),
        ("seed = 1\ngroup = 'impact'\n[[layer]]\nsynth = { kind = 'impulse', length = 5 }\n", r"battle\.x: missing 'variants'"),
        (BASE.replace('"impact"', '"loud"') + "[[layer]]\nsynth = { kind = 'impulse', length = 5 }\n", r"battle\.x: group 'loud'"),
        (BASE, r"battle\.x: has no \[\[layer\]\]"),
        (BASE + "[[layer]]\nvolume = 3\nsynth = { kind = 'impulse', length = 5 }\n", r"battle\.x: layer 1: unknown field 'volume'"),
        (BASE + "[[layer]]\nsynth = { kind = 'sine', hz = 100 }\n", r"battle\.x: layer 1: synth: missing 'length'"),
        (BASE + "[[layer]]\nsynth = { kind = 'sine', length = 100 }\n", r"battle\.x: layer 1: synth: missing 'hz'"),
        (BASE + "[[layer]]\nsynth = { kind = 'sine', hz = 1, length = 9, color = 'pink' }\n", r"layer 1: synth: unknown field 'color' for kind 'sine'"),
        (BASE + "[[layer]]\nsynth = { kind = 'chirp', length = 100 }\n", r"layer 1: synth: unknown kind 'chirp'"),
        (BASE + "[[layer]]\nsynth = { kind = 'impulse', length = 5 }\nfilter = [{ type = 'notch', hz = 100 }]\n", r"battle\.x: layer 1: filter 1: unknown type 'notch'"),
        (BASE + "[[layer]]\nsynth = { kind = 'impulse', length = 5 }\nfilter = [{ type = 'lowpass' }]\n", r"layer 1: filter 1: missing 'hz'"),
        (BASE + "[[layer]]\nsynth = { kind = 'impulse', length = 5 }\nfilter = [{ type = 'peak', hz = 100, hz_end = 200 }]\n", r"layer 1: filter 1: unknown field 'hz_end'"),
        (BASE + "[[layer]]\nsource = 'a'\npick = ['b']\n", r"layer 1: has more than one of source, pick and synth"),
        (BASE + "[[layer]]\ngain = 1\n", r"layer 1: needs one of source, pick or synth"),
        (BASE + "[[layer]]\npick = []\n", r"layer 1: pick: must be a non-empty list"),
        (BASE + "[[layer]]\nsource = 'a'\ngain = [3, 1]\n", r"layer 1: gain: a range must be \[lo, hi\] with lo <= hi"),
        (BASE + "[[layer]]\nsource = 'a'\ngain = 'loud'\n", r"layer 1: gain: must be a number or \[lo, hi\]"),
        (BASE + "[[layer]]\nsource = 'a'\nreverse = 1\n", r"layer 1: reverse: must be true or false"),
        (BASE + "[[layer]]\nsource = 'a'\nchance = 1.5\n", r"layer 1: chance: must lie between 0 and 1"),
        (BASE + "[[layer]]\nsource = 'a'\nenvelope = [[0]]\n", r"layer 1: envelope: point 1 must be \[ms, dB\]"),
        (BASE + "[[layer]]\nsource = 'a'\n[post]\nchain = [{ type = 'chorus' }]\n", r"battle\.x: post 1: unknown type 'chorus'"),
        (BASE + "[[layer]]\nsource = 'a'\n[post]\nchain = [{ type = 'reverb' }]\n", r"post 1: missing 'impulse'"),
        (BASE + "[[layer]]\nsource = 'a'\n[post]\ntail = 1\n", r"battle\.x: post: unknown field 'tail'"),
        ("variants = [", r"battle\.x: invalid TOML"),
    ],
)
def test_mistakes_are_named(text, message):
    with pytest.raises(AudioError, match=message):
        parse(text)


VARIED = BASE + """
[[layer]]
synth = { kind = "sine", hz = [100, 200], length = 50 }
gain = [-12, -6]

[[layer]]
pick = ["a", "b", "c", "d"]
offset = [0, 40]
"""


def test_ranges_are_drawn_within_bounds_and_differ_by_variant():
    recipe = parse(VARIED.replace("variants = 4", "variants = 8"))
    gains = [resolve(recipe, k).layers[0]["gain"] for k in range(8)]
    hz = [resolve(recipe, k).layers[0]["synth"]["hz"] for k in range(8)]
    assert all(-12 <= g <= -6 for g in gains) and len(set(gains)) == 8
    assert all(100 <= h <= 200 for h in hz) and len(set(hz)) == 8


def test_pick_uses_every_source_before_repeating():
    recipe = parse(VARIED.replace("variants = 4", "variants = 10"))
    picks = [resolve(recipe, k).layers[1]["source"] for k in range(10)]
    assert sorted(picks[:4]) == ["a", "b", "c", "d"]
    assert sorted(picks[4:8]) == ["a", "b", "c", "d"]
    assert len(set(picks[8:])) == 2


def test_chance_zero_and_one():
    never = parse(BASE + "[[layer]]\nsource = 'a'\nchance = 0\n[[layer]]\nsource = 'b'\nchance = 1\n")
    for k in range(20):
        layers = resolve(never, k).layers
        assert not layers[0]["included"] and layers[1]["included"]


def test_chance_between_includes_some():
    half = parse(BASE + "[[layer]]\nsource = 'a'\nchance = 0.5\n")
    included = [resolve(half, k).layers[0]["included"] for k in range(40)]
    assert 5 < sum(included) < 35


def test_a_variant_is_the_same_whatever_else_is_rendered():
    recipe = parse(VARIED)
    alone = resolve(recipe, 3)
    for k in (0, 1, 2):
        resolve(recipe, k)
    assert resolve(recipe, 3) == alone
    more = parse(VARIED.replace("variants = 4", "variants = 12"))
    assert resolve(more, 3) == alone


def test_the_order_of_keys_in_a_file_does_not_change_the_draws():
    a = parse(BASE + "[[layer]]\nsource = 'a'\ngain = [-9, 0]\npitch = [-2, 2]\noffset = [0, 9]\n")
    b = parse(BASE + "[[layer]]\noffset = [0, 9]\npitch = [-2, 2]\nsource = 'a'\ngain = [-9, 0]\n")
    assert resolve(a, 2) == resolve(b, 2)


def test_ranges_inside_filters_envelopes_and_post_are_drawn():
    recipe = parse(
        BASE
        + "[[layer]]\nsource = 'a'\nfilter = [{ type = 'bandpass', hz = [1700, 2600], q = 6 }]\n"
        + "envelope = [[0, [-6, 0]], [30, -48]]\n"
        + "[post]\nchain = [{ type = 'delay', ms = [80, 120], feedback = 0.3, wet_db = -12 }]\n"
    )
    variant = resolve(recipe, 0)
    assert 1700 <= variant.layers[0]["filter"][0]["hz"] <= 2600
    assert -6 <= variant.layers[0]["envelope"][0][1] <= 0
    assert 80 <= variant.post[0]["ms"] <= 120
