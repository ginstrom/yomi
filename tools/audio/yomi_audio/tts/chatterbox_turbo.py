"""Chatterbox Turbo (Resemble AI): clones one reference clip, renders the
nonverbal tags ([sigh], [laugh], ...) and ignores exaggeration and cfg_weight.
Backend: mlx-audio."""
from ..errors import AudioError
from . import _mlx
from .base import RenderJob
from .models import PINS


class Engine:
    name = "chatterbox_turbo"

    def __init__(self, pin=PINS["chatterbox_turbo"]):
        self.pin = pin

    def render(self, job: RenderJob):
        if job.reference_clip is None:
            raise AudioError(f"{self.name}: '{job.text[:40]}' needs a reference clip")
        params = _mlx.params(job)
        model = _mlx.load(self.pin)
        _mlx.seed(job.seed)
        results = model.generate(
            text=job.text,
            ref_audio=str(job.reference_clip),
            temperature=params.get("temperature", 0.8),
            verbose=False,
        )
        return _mlx.gather(results, f"{self.name}: '{job.text[:40]}'")

    def fingerprint(self) -> dict:
        return _mlx.fingerprint(self.name, self.pin)
