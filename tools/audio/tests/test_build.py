"""`sfx build` and `sfx check` (C6) over a copy of the fixture project.

The fixture copy lives at <tmp>/audio, so its banks go to
<tmp>/public/assets/audio/sfx and its voice files are looked for in
<tmp>/public/assets/voice, as the repository's are.
"""
import json
import re

import pytest

from yomi_audio import build as sfx
from yomi_audio.errors import AudioError
from conftest import run_cli

FIXTURE_CUES = ["battle.hit.slash", "battle.impact.fireball", "ui.click"]

# A plain, short recipe whose variants differ (a pitch range), cheap to render.
TONE = """variants = {variants}
seed = {seed}
group = "{group}"
{extra}
[[layer]]
synth = {{ kind = "triangle", hz = {hz}, length = {length} }}
pitch = {pitch}
envelope = [[0, 0], [{length}, -40]]
"""


def tone(variants=3, seed=1, group="ui", hz=900, length=120, pitch="[-6, 6]", extra=""):
    return TONE.format(variants=variants, seed=seed, group=group, hz=hz, length=length, pitch=pitch, extra=extra)


# The design's ui.click example (fixtures/project/sfx/ui/click.toml) fails two
# checks as written: its variants correlate at up to 0.999 (only a band-pass
# centre moves) and its low sine leaves a DC offset of about 1.4%. The build
# tests use this buildable version of it, still short enough to be
# peak-limited.
BUILDABLE_CLICK = """# The design's click, made buildable: wider bands, a pitch range, no DC.
variants = 4
seed = 3
group = "ui"
max_ms = 90

[[layer]]
synth = { kind = "impulse", length = 40 }
filter = [{ type = "bandpass", hz = [1200, 3600], q = 6 }]
envelope = [[0, 0], [30, -48]]

[[layer]]
synth = { kind = "noise", length = 20 }
filter = [{ type = "highpass", hz = [2000, 6000] }]
envelope = [[0, 0], [20, -50]]
gain = [-12, -4]

[[layer]]
synth = { kind = "sine", hz = [140, 260], hz_end = 110, length = 25 }
filter = [{ type = "highpass", hz = 90 }]
envelope = [[0, -6], [25, -60]]
gain = -12
"""


@pytest.fixture
def project(project):
    (project / "sfx" / "ui" / "click.toml").write_text(BUILDABLE_CLICK)
    return project


def bank_dir(project):
    return project.parent / "public" / "assets" / "audio" / "sfx"


def manifest(project):
    return json.loads((project / "sfx.manifest.json").read_text())


def quiet(*args, **kwargs):
    return sfx.build(*args, echo=lambda *a: None, **kwargs)


def problems(project):
    return sfx.check(project, echo=lambda *a: None)


@pytest.fixture
def built(project):
    quiet(project)
    return project


# Build: shapes ------------------------------------------------------------------------


def test_build_writes_the_manifest_and_banks_in_c6_shape(built):
    data = manifest(built)
    assert data["version"] == 1
    assert data["tool"] == "yomi-audio 0.1.0"
    assert sorted(data["cues"]) == FIXTURE_CUES
    assert sorted(data["banks"]) == ["battle", "ui"]
    for name, bank in data["banks"].items():
        for fmt in ("opus", "mp3"):
            path = bank_dir(built) / f"{name}.{fmt}"
            assert path.stat().st_size == bank[fmt]["bytes"]
            assert re.fullmatch(r"[0-9a-f]{64}", bank[fmt]["sha256"])
        assert isinstance(bank["durationMs"], int) and bank["durationMs"] > 0
    slash = data["cues"]["battle.hit.slash"]
    assert slash["bank"] == "battle"
    assert slash["markers"] == [f"battle.hit.slash#{k}" for k in range(6)]
    assert len(slash["durationsMs"]) == 6 and all(isinstance(d, int) and d > 0 for d in slash["durationsMs"])
    assert re.fullmatch(r"[0-9a-f]{64}", slash["inputs"])


def test_bank_json_is_a_phaser_audio_sprite_with_gaps(built):
    data = manifest(built)
    sprite = json.loads((bank_dir(built) / "battle.json").read_text())
    assert sprite["resources"] == ["battle.opus", "battle.mp3"]
    markers = list(sprite["spritemap"])
    expected = [m for cue in sorted(data["cues"]) if data["cues"][cue]["bank"] == "battle"
                for m in data["cues"][cue]["markers"]]
    assert markers == expected
    durations = [d for cue in sorted(data["cues"]) if data["cues"][cue]["bank"] == "battle"
                 for d in data["cues"][cue]["durationsMs"]]
    previous_end = 0.0
    for marker, duration in zip(markers, durations):
        entry = sprite["spritemap"][marker]
        assert entry["loop"] is False
        assert entry["start"] == pytest.approx(previous_end + 0.050, abs=1e-9)  # gap_ms of silence before each
        assert entry["end"] - entry["start"] == pytest.approx(duration / 1000, abs=1e-9)
        previous_end = entry["end"]
    assert data["banks"]["battle"]["durationMs"] == round(1000 * previous_end) + 50  # and after the last


def test_bank_audio_is_mono_and_as_long_as_the_bank(built):
    import subprocess

    for fmt in ("opus", "mp3"):
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "stream=channels:format=duration", "-of", "json",
             str(bank_dir(built) / f"ui.{fmt}")], capture_output=True, text=True, check=True,
        )
        probe = json.loads(out.stdout)
        assert probe["streams"][0]["channels"] == 1
        expected = manifest(built)["banks"]["ui"]["durationMs"] / 1000
        assert float(probe["format"]["duration"]) == pytest.approx(expected, abs=0.06)


def test_the_manifest_is_written_in_a_stable_order(built):
    text = (built / "sfx.manifest.json").read_text()
    assert text.endswith("\n")
    assert text == json.dumps(json.loads(text), indent=2, sort_keys=True) + "\n"


def test_build_then_check_passes(built):
    assert problems(built) == []


# Build: incremental -------------------------------------------------------------------


def test_a_second_build_renders_nothing_and_changes_no_file(built):
    files = {p: p.read_bytes() for p in [built / "sfx.manifest.json", *bank_dir(built).iterdir()]}
    report = quiet(built)
    assert report.rendered == [] and report.banks == []
    assert {p: p.read_bytes() for p in files} == files


def test_a_changed_recipe_rebuilds_only_its_bank(built):
    ui_opus = (bank_dir(built) / "ui.opus").read_bytes()
    path = built / "sfx" / "battle" / "hit.slash.toml"
    path.write_text(path.read_text() + "\n# a comment\n")
    report = quiet(built)
    assert report.changed == ["battle.hit.slash"]
    assert report.banks == ["battle"]
    assert (bank_dir(built) / "ui.opus").read_bytes() == ui_opus
    assert problems(built) == []


def test_naming_a_cue_or_bank_rebuilds_it(built):
    assert quiet(built, cue="ui.click").banks == ["ui"]
    assert quiet(built, bank="battle").banks == ["battle"]


def test_naming_an_unknown_cue_or_bank_is_refused(built):
    with pytest.raises(AudioError, match="ui.nothing"):
        quiet(built, cue="ui.nothing")
    with pytest.raises(AudioError, match="music"):
        quiet(built, bank="music")


def test_a_removed_recipe_leaves_the_manifest_and_an_emptied_bank_goes(built):
    (built / "sfx" / "ui" / "click.toml").unlink()
    quiet(built)
    data = manifest(built)
    assert "ui.click" not in data["cues"] and "ui" not in data["banks"]
    assert not any(bank_dir(built).glob("ui.*"))
    assert problems(built) == []


def test_a_recipe_outside_the_banks_is_refused(built):
    (built / "sfx" / "music").mkdir()
    (built / "sfx" / "music" / "theme.toml").write_text(tone())
    with pytest.raises(AudioError, match="music"):
        quiet(built)


# Check: AC8 ---------------------------------------------------------------------------


def test_check_names_a_cue_whose_recipe_changed(built):
    path = built / "sfx" / "ui" / "click.toml"
    path.write_text(path.read_text() + "\n# edited\n")
    found = problems(built)
    assert len(found) == 1 and "ui.click" in found[0]


def test_check_names_a_cue_whose_source_changed(built):
    flac = built / "sources" / "stand_in" / "kenney_impact_metal_light_2.flac"
    flac.write_bytes(flac.read_bytes()[:-4] + bytes(4))
    assert any("battle.hit.slash" in p for p in problems(built))


def test_check_names_a_recipe_without_a_manifest_entry(built):
    (built / "sfx" / "ui" / "new.toml").write_text(tone())
    found = problems(built)
    assert any("ui.new" in p and "no manifest entry" in p for p in found)


def test_check_names_a_manifest_entry_without_a_recipe(built):
    (built / "sfx" / "ui" / "click.toml").unlink()
    assert any("ui.click" in p and "no recipe" in p for p in problems(built))


def test_check_names_a_missing_bank_file(built):
    (bank_dir(built) / "ui.mp3").unlink()
    assert any("ui.mp3" in p and "missing" in p for p in problems(built))


def test_check_names_a_tampered_bank_file(built):
    path = bank_dir(built) / "battle.opus"
    path.write_bytes(path.read_bytes()[:-8] + bytes(8))
    assert any("battle.opus" in p for p in problems(built))


def test_check_names_a_bank_json_that_disagrees_with_the_manifest(built):
    path = bank_dir(built) / "ui.json"
    sprite = json.loads(path.read_text())
    sprite["spritemap"].pop("ui.click#3")
    path.write_text(json.dumps(sprite))
    assert any("ui.json" in p for p in problems(built))


def test_check_writes_nothing(built):
    before = {p: p.stat().st_mtime_ns for p in built.parent.rglob("*") if p.is_file()}
    (built / "sfx" / "ui" / "new.toml").write_text(tone())
    problems(built)
    after = {p: p.stat().st_mtime_ns for p in built.parent.rglob("*") if p.is_file()}
    after.pop(built / "sfx" / "ui" / "new.toml")
    assert after == before


def test_check_without_a_manifest_names_every_recipe(project):
    found = problems(project)
    for cue in FIXTURE_CUES:
        assert any(cue in p for p in found)


def test_cli_check_fails_naming_the_cue(built):
    path = built / "sfx" / "ui" / "click.toml"
    path.write_text(path.read_text() + "\n# edited\n")
    result = run_cli("sfx", "check", "--root", str(built))
    assert result.returncode == 1
    assert "ui.click" in result.stderr and "Traceback" not in result.stderr


def test_cli_build_and_check_pass(project):
    assert run_cli("sfx", "build", "--root", str(project)).returncode == 0
    result = run_cli("sfx", "check", "--root", str(project))
    assert result.returncode == 0, result.stderr


# Build: sources ----------------------------------------------------------------------


def test_a_source_with_a_cc_by_licence_fails_the_build_naming_it(project):
    path = project / "sources.toml"
    text = path.read_text()
    at = text.index('id = "oga_hit_flesh_7"')
    path.write_text(text[:at] + text[at:].replace('licence = "own"', 'licence = "CC-BY-4.0"', 1))
    with pytest.raises(AudioError, match="oga_hit_flesh_7.*CC-BY-4.0"):
        quiet(project)
    assert not (project / "sfx.manifest.json").exists()


def test_a_source_whose_file_does_not_match_its_sha_fails_the_build(project):
    flac = project / "sources" / "stand_in" / "fs_fire_whoosh_2.flac"
    flac.write_bytes(flac.read_bytes()[:-4] + bytes(4))
    with pytest.raises(AudioError, match="fs_fire_whoosh_2.*SHA-256"):
        quiet(project)


def test_check_names_a_cue_whose_source_licence_is_not_allowed(built):
    path = built / "sources.toml"
    text = path.read_text()
    at = text.index('id = "oga_hit_flesh_7"')
    path.write_text(text[:at] + text[at:].replace('licence = "own"', 'licence = "CC-BY-4.0"', 1))
    assert any("battle.hit.slash" in p and "CC-BY-4.0" in p for p in problems(built))


# Build: per-variant checks -------------------------------------------------------------


def write(project, cue, text):
    bank, name = cue.split(".", 1)
    (project / "sfx" / bank / f"{name}.toml").write_text(text)


def build_failure(project) -> str:
    with pytest.raises(AudioError) as caught:
        quiet(project)
    assert not (project / "sfx.manifest.json").exists()
    return str(caught.value)


def test_identical_variants_fail_the_correlation_check(project):
    write(project, "ui.same", tone(variants=2, pitch="0"))
    message = build_failure(project)
    assert "ui.same" in message and "correlat" in message


def test_a_one_variant_cue_is_exempt_from_the_correlation_check(project):
    write(project, "ui.once", tone(variants=1, pitch="0"))
    quiet(project)
    assert "ui.once" in manifest(project)["cues"]


def test_a_variant_longer_than_max_ms_fails(project):
    write(project, "ui.long", tone(length=300, extra="max_ms = 200"))
    message = build_failure(project)
    assert re.search(r"ui\.long#0.*max_ms", message)


def test_a_variant_over_its_ceiling_fails(project, monkeypatch):
    # The renderer never passes a ceiling itself; check that the build would
    # still catch a variant that did (a future post step after normalising).
    from yomi_audio import recipe

    real = recipe.render_variant
    monkeypatch.setattr(sfx, "render_variant", lambda r, k, reg, sr: real(r, k, reg, sr) * 4.0)
    message = build_failure(project)
    assert re.search(r"ui\.click#\d.*true peak", message)


def test_a_variant_off_its_loudness_target_fails(project, monkeypatch):
    from yomi_audio import recipe

    real = recipe.render_variant
    monkeypatch.setattr(sfx, "render_variant", lambda r, k, reg, sr: real(r, k, reg, sr) * 0.5)
    message = build_failure(project)
    assert re.search(r"battle\.impact\.fireball#\d.*LUFS", message)


def test_a_variant_with_dc_offset_fails(project, monkeypatch):
    from yomi_audio import recipe

    real = recipe.render_variant
    monkeypatch.setattr(sfx, "render_variant", lambda r, k, reg, sr: real(r, k, reg, sr) * 0.2 + 0.01)
    message = build_failure(project)
    assert "DC offset" in message


def test_every_failing_cue_is_reported_in_one_build(project):
    write(project, "ui.same", tone(variants=2, pitch="0"))
    write(project, "ui.long", tone(length=300, extra="max_ms = 200"))
    message = build_failure(project)
    assert "ui.same" in message and "ui.long" in message


def test_a_peak_limited_short_cue_passes(project):
    # ui.click cannot reach -26 LUFS-M under -6 dBTP; the ceiling wins and
    # the build accepts it, saying so.
    lines = []
    sfx.build(project, echo=lines.append)
    assert "ui.click" in manifest(project)["cues"]
    assert any("ui.click" in line and "peak-limited" in line for line in lines)


# Budgets -----------------------------------------------------------------------------


def set_budget(project, name, value):
    path = project / "audio.toml"
    path.write_text(re.sub(rf"(?m)^{name} = .*$", f"{name} = {value}", path.read_text()))


def test_the_sfx_budget_fails_the_build_before_writing(project):
    set_budget(project, "sfx_bytes_per_format", 1000)
    message = build_failure(project)
    assert "sfx_bytes_per_format" in message
    assert not bank_dir(project).exists() or not any(bank_dir(project).iterdir())


def test_the_sources_budget_fails_the_build(project):
    set_budget(project, "sources_bytes", 1000)
    assert "sources_bytes" in build_failure(project)


def test_check_names_each_budget_exceeded(built):
    set_budget(built, "sfx_bytes_per_format", 1000)
    set_budget(built, "sources_bytes", 1000)
    voice = built.parent / "public" / "assets" / "voice"
    voice.mkdir(parents=True)
    (voice / "line.opus").write_bytes(bytes(2000))
    set_budget(built, "voice_bytes_per_format", 1000)
    found = " ".join(problems(built))
    for name in ("sfx_bytes_per_format", "sources_bytes", "voice_bytes_per_format"):
        assert name in found


# Review round 1 ----------------------------------------------------------------------


def set_entry(project, id, field, value):
    path = project / "sources.toml"
    text = path.read_text()
    at = text.index(f'id = "{id}"')
    rest = re.sub(rf'(?m)^{field} = ".*"$', f'{field} = "{value}"', text[at:], count=1)
    path.write_text(text[:at] + rest)


def test_an_incremental_build_still_refuses_a_licence_changed_since(built):
    set_entry(built, "oga_hit_flesh_7", "licence", "CC-BY-4.0")
    with pytest.raises(AudioError, match="battle.hit.slash.*oga_hit_flesh_7.*CC-BY-4.0"):
        quiet(built)


def test_a_cue_build_still_checks_every_other_cues_sources(built):
    set_entry(built, "oga_hit_flesh_7", "licence", "CC-BY-4.0")
    with pytest.raises(AudioError, match="battle.hit.slash.*oga_hit_flesh_7"):
        quiet(built, cue="ui.click")


def test_an_incremental_build_still_refuses_an_edited_sha256_field(built):
    set_entry(built, "oga_hit_flesh_7", "sha256", "0" * 64)
    with pytest.raises(AudioError, match="oga_hit_flesh_7.*SHA-256"):
        quiet(built)


def test_check_reports_a_cue_stale_when_its_sources_entry_changes(built):
    set_entry(built, "oga_hit_flesh_7", "licence", "CC0-1.0")  # still allowed, but not what was built
    found = problems(built)
    assert any("battle.hit.slash" in p and "changed since the last build" in p for p in found)


def test_check_compares_the_whole_bank_json(built):
    path = bank_dir(built) / "ui.json"
    sprite = json.loads(path.read_text())
    first = next(iter(sprite["spritemap"]))
    sprite["spritemap"][first]["start"] += 0.010  # same order, but moved
    sprite["spritemap"][first]["end"] += 0.010
    path.write_text(json.dumps(sprite))
    assert any("ui.json" in p for p in problems(built))


def test_check_names_a_bank_json_with_wrong_resources_or_loop(built):
    path = bank_dir(built) / "ui.json"
    sprite = json.loads(path.read_text())
    sprite["resources"] = ["ui.ogg"]
    path.write_text(json.dumps(sprite))
    assert any("ui.json" in p for p in problems(built))
