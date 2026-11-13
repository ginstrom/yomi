"""Qwen3-TTS 1.7B CustomVoice: one of the model's preset speakers (the voice
table's `preset`), steered by a natural-language instruction (the job's, else
the emotion's, worded by intensity). Backend: mlx-audio."""
from ..errors import AudioError
from . import _mlx
from .base import RenderJob, qwen_instruction
from .models import PINS


class Engine:
    name = "qwen3_custom"

    def __init__(self, pin=PINS["qwen3_custom"]):
        self.pin = pin

    def render(self, job: RenderJob):
        preset = job.voice.get("preset")
        if not preset:
            raise AudioError(f"{self.name}: the voice has no preset speaker")
        params = _mlx.params(job)
        model = _mlx.load(self.pin)
        _mlx.seed(job.seed)
        results = model.generate_custom_voice(
            text=job.text,
            speaker=preset,
            language=params.get("language", "english"),
            instruct=job.instruction or qwen_instruction(job.emotion, job.intensity),
            **({"temperature": params["temperature"]} if "temperature" in params else {}),
        )
        return _mlx.gather(results, f"{self.name}: '{job.text[:40]}'")

    def fingerprint(self) -> dict:
        return _mlx.fingerprint(self.name, self.pin)
