"""BM25 keyword ranking, implemented from scratch (no LLM, no ts_rank).

Two pieces:
  * tokenize / term_frequencies  -> build the inverted index during ingestion
  * bm25_scores                  -> score pages for a query at search time

BM25 combines three intuitions per query term:
  * TF  — more occurrences help, with diminishing returns (the k1 term)
  * IDF — rarer terms across the corpus matter more
  * length normalization — a match in a short doc counts more (the b term)
"""
import math
import re
from collections import Counter

# Tunable BM25 constants (standard defaults).
K1 = 1.5  # term-frequency saturation
B = 0.75  # document-length normalization strength

# Skip absurdly long tokens (base64 blobs, tracking IDs) — useless for search
# and they'd overflow the postings.term column. Real words are far shorter.
_MAX_TERM_LEN = 40

_TOKEN_RE = re.compile(r"[a-z0-9]+")

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
    "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these",
    "those", "as", "at", "by", "from", "how", "what", "which", "you", "your", "we",
    "they", "he", "she", "his", "her", "their", "our", "not", "can", "will", "has",
    "have", "had", "do", "does", "did", "so", "if", "then", "than", "about", "into",
    "i", "my", "me", "us", "them", "there", "here", "up", "out", "over", "also",
}


def tokenize(text: str) -> list[str]:
    """Lowercase, split on non-alphanumerics, drop stopwords, 1-char and huge tokens."""
    return [
        t
        for t in _TOKEN_RE.findall(text.lower())
        if 1 < len(t) <= _MAX_TERM_LEN and t not in _STOPWORDS
    ]


def term_frequencies(text: str) -> tuple[dict[str, int], int]:
    """Return ({term: count}, total_token_count) for indexing a document."""
    tokens = tokenize(text)
    return dict(Counter(tokens)), len(tokens)


def idf(term_df: int, n_docs: int) -> float:
    """Inverse document frequency (BM25's probabilistic form, always >= 0)."""
    return math.log(1 + (n_docs - term_df + 0.5) / (term_df + 0.5))


def bm25_scores(
    postings: list[tuple[int, str, int]],
    doc_len: dict[int, int],
    doc_freq: dict[str, int],
    n_docs: int,
    avgdl: float,
) -> dict[int, float]:
    """Score each page that contains a query term.

    postings : (page_id, term, tf) rows for the query terms only
    doc_len  : {page_id: token_count}
    doc_freq : {term: number of docs containing it}
    """
    avgdl = avgdl or 1.0
    idfs = {term: idf(df, n_docs) for term, df in doc_freq.items()}
    scores: dict[int, float] = {}
    for page_id, term, tf in postings:
        length = doc_len.get(page_id) or avgdl
        denom = tf + K1 * (1 - B + B * length / avgdl)
        scores[page_id] = scores.get(page_id, 0.0) + idfs.get(term, 0.0) * (tf * (K1 + 1)) / denom
    return scores
