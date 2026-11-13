"""Speaker similarity: the cosine between Chatterbox's voice-encoder
embeddings of two clips (design §5.8.3). Candidates below `THRESHOLD` of the
neutral clip are taken for another voice."""
import numpy as np

from . import _mlx
from .models import PINS

THRESHOLD = 0.75


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    a, b = np.asarray(a, dtype=np.float64).ravel(), np.asarray(b, dtype=np.float64).ravel()
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    return float(a @ b / norm) if norm else 0.0


class ChatterboxEncoder:
    """`embed(pcm, sr)`: the speaker embedding from Chatterbox's voice encoder."""

    def __init__(self, pin=PINS["chatterbox"]):
        self.pin = pin

    def embed(self, pcm: np.ndarray, sr: int) -> np.ndarray:
        import mlx.core as mx

        model = _mlx.load(self.pin)
        embedding = model.ve.embeds_from_wavs([mx.array(np.asarray(pcm, dtype=np.float32))], sample_rate=sr, as_spk=True)
        return np.asarray(embedding, dtype=np.float64).ravel()
