"""The pinned models the engines load (step 03's bake-off).

Each engine loads an MLX conversion from mlx-community through mlx-audio,
pinned to a Hugging Face commit; `upstream` is the model it was converted
from, whose card states the licence that governs the weights and their
output. Licences were checked on each card on `CHECKED` (see docs/reference/audio.md, "Narration engines").
Step 15 copies the chosen pins into `audio/voices.toml`.
"""
from dataclasses import dataclass

CHECKED = "2026-11-14"
BACKEND = "mlx-audio==0.6.5"


@dataclass(frozen=True)
class ModelPin:
    repo: str
    revision: str
    upstream: str
    upstream_revision: str
    licence: str                # the upstream card's licence
    quantisation: str


PINS: dict[str, ModelPin] = {
    "chatterbox": ModelPin(
        repo="mlx-community/chatterbox-fp16",
        revision="4923fcca09086356aeab5191a2348c5a17a23694",
        upstream="ResembleAI/chatterbox",
        upstream_revision="5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18",
        licence="MIT",
        quantisation="fp16",
    ),
    "chatterbox_turbo": ModelPin(
        repo="mlx-community/chatterbox-turbo-fp16",
        revision="b2d0a13aa7cfff0a06d9acb247ae91c8f19a6d75",
        upstream="ResembleAI/chatterbox-turbo",
        upstream_revision="749d1c1a46eb10492095d68fbcf55691ccf137cd",
        licence="MIT",
        quantisation="fp16",
    ),
    "qwen3_custom": ModelPin(
        repo="mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-bf16",
        revision="52f4770fd9726457eae3d3b6aa92047a25a10776",
        upstream="Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice",
        upstream_revision="0c0e3051f131929182e2c023b9537f8b1c68adfe",
        licence="Apache-2.0",
        quantisation="bf16",
    ),
    "qwen3_design": ModelPin(
        repo="mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16",
        revision="7d3824abff87e49756bb0f83fb5411de75d160c4",
        upstream="Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
        upstream_revision="5ecdb67327fd37bb2e042aab12ff7391903235d3",
        licence="Apache-2.0",
        quantisation="bf16",
    ),
}
