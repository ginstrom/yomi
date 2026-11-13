"""What every engine shares: loading a pinned model through mlx-audio, seeding,
and gathering its output. mlx is imported only inside these functions."""
from pathlib import Path

import numpy as np

from ..errors import AudioError
from .base import ADAPTER_VERSION
from .models import BACKEND, ModelPin

_loaded: dict[tuple[str, str], object] = {}


def load(pin: ModelPin):
    """The model at its pinned revision, downloaded into the Hugging Face cache
    on first use and kept loaded for the process."""
    key = (pin.repo, pin.revision)
    if key not in _loaded:
        try:
            from huggingface_hub import snapshot_download
            from mlx_audio.tts.utils import load_model
        except ImportError:
            raise AudioError(
                "narration needs the tts extra: uv run --project tools/audio --extra tts yomi-audio ..."
            ) from None
        path = snapshot_download(pin.repo, revision=pin.revision)
        _loaded[key] = load_model(Path(path))
    return _loaded[key]


def seed(value: int) -> None:
    import mlx.core as mx

    mx.random.seed(int(value) & 0xFFFFFFFF)


def gather(results, what: str) -> tuple[np.ndarray, int]:
    """Concatenates a generator of mlx-audio `GenerationResult`s into mono float32."""
    pieces, sr = [], None
    for result in results:
        pieces.append(np.asarray(result.audio, dtype=np.float32).reshape(-1))
        sr = result.sample_rate
    if not pieces or sr is None or not sum(len(p) for p in pieces):
        raise AudioError(f"{what}: the engine returned no audio")
    return np.concatenate(pieces), int(sr)


def fingerprint(name: str, pin: ModelPin) -> dict:
    return {
        "engine": name,
        "model": pin.repo,
        "revision": pin.revision,
        "upstream": pin.upstream,
        "upstream_revision": pin.upstream_revision,
        "quantisation": pin.quantisation,
        "backend": BACKEND,
        "adapter_version": ADAPTER_VERSION,
    }


def params(job) -> dict:
    return dict(job.voice.get("params") or {})
