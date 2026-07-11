"""Pluggable text embedder.

Uses sentence-transformers (all-MiniLM-L6-v2) when the `ml` extra is installed;
otherwise a deterministic hashing embedder so page_embeddings is still populated
and the app runs end-to-end. Install `.[ml]` and re-process for real semantic
quality — the two are not comparable, so don't mix them in one database.
"""
import hashlib
import math
from typing import Protocol, runtime_checkable

from app.config import settings

_st_model = None  # cached SentenceTransformer, loaded once


@runtime_checkable
class Embedder(Protocol):
    def embed(self, text: str) -> list[float]: ...


class HashingEmbedder:
    """Fallback: bag-of-words hashed into a fixed-length normalized vector."""

    def __init__(self, dim: int) -> None:
        self.dim = dim

    def embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in text.lower().split():
            bucket = int(hashlib.md5(token.encode()).hexdigest(), 16) % self.dim
            vec[bucket] += 1.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


class SentenceTransformerEmbedder:
    def __init__(self) -> None:
        global _st_model
        if _st_model is None:
            from sentence_transformers import SentenceTransformer

            _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        self._model = _st_model

    def embed(self, text: str) -> list[float]:
        return self._model.encode(text, normalize_embeddings=True).tolist()


def get_embedder() -> Embedder:
    try:
        import sentence_transformers  # noqa: F401
    except ImportError:
        return HashingEmbedder(settings.embedding_dim)
    return SentenceTransformerEmbedder()
