"""Chatterbox (Resemble AI), cloning the emotion's reference clip, with the
emotion's `exaggeration` (by intensity) and `cfg_weight`. Backend: mlx-audio."""
from ..errors import AudioError
from . import _mlx
from .base import RenderJob, emotion_spec, exaggeration
from .models import PINS


class Engine:
    name = "chatterbox"

    def __init__(self, pin=PINS["chatterbox"]):
        self.pin = pin

    def render(self, job: RenderJob):
        if job.reference_clip is None:
            raise AudioError(f"{self.name}: '{job.text[:40]}' needs a reference clip")
        params = _mlx.params(job)
        model = _mlx.load(self.pin)
        _mlx.seed(job.seed)
        results = model.generate(
            text=job.text,
            audio_prompt=str(job.reference_clip),
            audio_prompt_sr=model.sample_rate,
            exaggeration=exaggeration(job.emotion, job.intensity),
            cfg_weight=params.get("cfg_weight", emotion_spec(job.emotion).cfg_weight),
            temperature=params.get("temperature", 0.8),
            verbose=False,
        )
        return _mlx.gather(results, f"{self.name}: '{job.text[:40]}'")

    def fingerprint(self) -> dict:
        return _mlx.fingerprint(self.name, self.pin)
