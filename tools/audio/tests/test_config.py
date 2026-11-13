import pytest

from yomi_audio.config import load_config
from yomi_audio.errors import AudioError
from conftest import FIXTURE


def test_reads_groups_and_settings():
    config = load_config(FIXTURE)
    assert config.sample_rate == 48000
    assert config.gap_ms == 50
    assert config.banks == ("ui", "battle", "world", "stings")
    impact = config.groups["impact"]
    assert (impact.measure, impact.target, impact.tolerance, impact.peak) == ("momentary_max", -19, 1.0, -1.0)
    assert config.groups["sting"].measure == "integrated"
    assert config.budgets["sfx_bytes_per_format"] == 3_000_000
    assert config.encode["voice"]["opus_kbps"] == 32
    assert config.voice["target_lufs_i"] == -18


def test_a_bad_group_names_it(empty_project):
    text = (empty_project / "audio.toml").read_text()
    (empty_project / "audio.toml").write_text(text.replace('measure = "integrated"', 'measure = "loudest"'))
    with pytest.raises(AudioError, match="groups.sting.*measure"):
        load_config(empty_project)


def test_a_missing_file_is_an_error(tmp_path):
    with pytest.raises(AudioError, match="audio.toml"):
        load_config(tmp_path)
