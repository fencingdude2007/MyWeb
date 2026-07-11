"""Keyword + named-entity extraction.

spaCy (en_core_web_sm) when available via the `ml` extra; otherwise a simple
stopword-filtered frequency count for keywords and no entities.
"""
import re
from collections import Counter

_spacy_nlp = None  # cached spaCy pipeline

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
    "those", "as", "at", "by", "from", "how", "what", "which", "you", "your", "we",
    "they", "he", "she", "his", "her", "their", "our", "not", "can", "will", "has",
    "have", "had", "do", "does", "did", "so", "if", "then", "than", "about", "into",
}


def _fallback_keywords(text: str, top_n: int = 8) -> list[str]:
    words = re.findall(r"[a-z][a-z-]{2,}", text.lower())
    counts = Counter(w for w in words if w not in _STOPWORDS)
    return [word for word, _ in counts.most_common(top_n)]


def extract_keywords_entities(text: str) -> tuple[list[str], list[tuple[str, str]]]:
    """Return (keywords, [(entity_text, entity_label), ...])."""
    global _spacy_nlp
    excerpt = text[:20000]
    try:
        import spacy

        if _spacy_nlp is None:
            _spacy_nlp = spacy.load("en_core_web_sm")
    except (ImportError, OSError):
        return _fallback_keywords(excerpt), []

    doc = _spacy_nlp(excerpt)
    entities: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for ent in doc.ents:
        key = (ent.text.strip(), ent.label_)
        if key[0] and key not in seen:
            seen.add(key)
            entities.append(key)

    noun_chunks = Counter(
        chunk.text.lower().strip()
        for chunk in doc.noun_chunks
        if 2 < len(chunk.text) < 40
    )
    keywords = [kw for kw, _ in noun_chunks.most_common(8)] or _fallback_keywords(excerpt)
    return keywords, entities[:30]
