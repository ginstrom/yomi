"""Qwen3-TTS 1.7B VoiceDesign: a voice made from a text description, used only
to design reference clips (`voice design`). The instruction, when given, is
appended to the description. Backend: mlx-audio."""
from ..errors import AudioError
from . import _mlx
from .base import RenderJob
from .models import PINS


def design_prompt(description: str, instruction: str | None) -> str:
    return f"{description} {instruction}" if instruction else description


class Engine:
    name = "qwen3_design"

    def __init__(self, pin=PINS["qwen3_design"]):
        self.pin = pin

    def design(self, description: str, text: str, instruction: str | None, seed: int):
        model = _mlx.load(self.pin)
        _mlx.seed(seed)
        results = model.generate_voice_design(
            text=text, instruct=design_prompt(description, instruction), language="english"
        )
        return _mlx.gather(results, f"{self.name}: '{text[:40]}'")

    def render(self, job: RenderJob):
        description = job.voice.get("description")
        if not description:
            raise AudioError(f"{self.name}: the voice has no description")
        return self.design(description, job.text, job.instruction, job.seed)

    def fingerprint(self) -> dict:
        return _mlx.fingerprint(self.name, self.pin)
