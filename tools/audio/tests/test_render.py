import hashlib
import subprocess
import sys

import numpy as np
import pytest

from yomi_audio import loudness
from yomi_audio.config import load_config
from yomi_audio.errors import AudioError
from yomi_audio.recipe import load_recipe, render, render_variant
from yomi_audio.sources import Registry
from conftest import FIXTURE

EXAMPLES = ["battle.hit.slash", "battle.impact.fireball", "ui.click"]


def pcm_hash(variants):
    digest = hashlib.sha256()
    for x in variants:
        digest.update(np.ascontiguousarray(x, dtype=np.float64).tobytes())
    return digest.hexdigest()


@pytest.mark.parametrize("cue", EXAMPLES)
def test_the_design_examples_render_on_target(cue):
    config = load_config(FIXTURE)
    recipe = load_recipe(config, cue)
    variants = render(recipe, Registry.load(FIXTURE), config.sample_rate)
    assert len(variants) == recipe.variants
    for x in variants:
        assert x.dtype == np.float64 and x.ndim == 1 and len(x) > 0
        assert loudness.measure(x, 48000, recipe.group.measure) == pytest.approx(recipe.group.target, abs=0.1)
    # No two variants are the same sound.
    assert len({pcm_hash([x]) for x in variants}) == len(variants)


def test_a_variant_renders_the_same_alone_or_after_others():
    config = load_config(FIXTURE)
    recipe = load_recipe(config, "battle.hit.slash")
    registry = Registry.load(FIXTURE)
    alone = render_variant(recipe, 4, registry, 48000)
    in_turn = render(recipe, registry, 48000)[4]
    assert np.array_equal(alone, in_turn)


RENDER_IN_A_FRESH_PROCESS = """
import hashlib, sys
import numpy as np
from yomi_audio.config import load_config
from yomi_audio.recipe import load_recipe, render
from yomi_audio.sources import Registry
root = sys.argv[1]
config = load_config(root)
digest = hashlib.sha256()
for cue in sys.argv[2:]:
    for x in render(load_recipe(config, cue), Registry.load(root), config.sample_rate):
        digest.update(np.ascontiguousarray(x, dtype=np.float64).tobytes())
print(digest.hexdigest())
"""


def test_rendering_is_bit_identical_across_processes():
    hashes = {
        subprocess.run(
            [sys.executable, "-c", RENDER_IN_A_FRESH_PROCESS, str(FIXTURE), *EXAMPLES],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        for _ in range(2)
    }
    assert len(hashes) == 1 and len(next(iter(hashes))) == 64


def render_slash(project):
    config = load_config(project)
    return render(load_recipe(config, "battle.hit.slash"), Registry.load(project), config.sample_rate)


def test_a_source_with_a_disallowed_licence_fails_to_render(project):
    path = project / "sources.toml"
    text = path.read_text()
    at = text.index('id = "kenney_impact_metal_light_2"')
    path.write_text(text[:at] + text[at:].replace('licence = "own"', 'licence = "CC-BY-4.0"', 1))
    with pytest.raises(AudioError, match="battle.hit.slash.*kenney_impact_metal_light_2.*CC-BY-4.0"):
        render_slash(project)


def test_a_missing_source_file_fails_to_render(project):
    (project / "sources" / "stand_in" / "kenney_impact_metal_light_2.flac").unlink()
    with pytest.raises(AudioError, match="battle.hit.slash.*kenney_impact_metal_light_2.*missing"):
        render_slash(project)


def test_a_changed_source_file_fails_to_render(project):
    flac = project / "sources" / "stand_in" / "kenney_impact_metal_light_2.flac"
    flac.write_bytes(flac.read_bytes()[:-10] + bytes(10))
    with pytest.raises(AudioError, match="kenney_impact_metal_light_2.*SHA-256"):
        render_slash(project)


def test_a_changed_impulse_fails_to_render(project):
    flac = project / "impulses" / "small_room.flac"
    flac.write_bytes(flac.read_bytes()[:-10] + bytes(10))
    with pytest.raises(AudioError, match="impulse_small_room.*SHA-256"):
        render_slash(project)


def test_an_unregistered_source_fails_to_render(project):
    path = project / "sfx" / "battle" / "hit.slash.toml"
    path.write_text(path.read_text().replace('"oga_hit_flesh_7"', '"oga_nowhere"'))
    with pytest.raises(AudioError, match="battle.hit.slash.*oga_nowhere"):
        render_slash(project)


def test_a_recipe_whose_layers_all_drop_out_is_named(project):
    (project / "sfx" / "ui" / "gone.toml").write_text(
        'variants = 1\nseed = 1\ngroup = "ui"\n[[layer]]\nsynth = { kind = "impulse", length = 5 }\nchance = 0\n'
    )
    config = load_config(project)
    with pytest.raises(AudioError, match=r"ui\.gone#0.*chance"):
        render(load_recipe(config, "ui.gone"), Registry.load(project), 48000)
