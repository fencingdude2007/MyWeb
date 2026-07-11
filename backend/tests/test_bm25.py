from app.services.bm25 import bm25_scores, term_frequencies, tokenize


def test_tokenize_lowercases_and_drops_stopwords() -> None:
    assert tokenize("The Quick BROWN fox") == ["quick", "brown", "fox"]


def test_term_frequencies_counts_and_totals() -> None:
    freqs, total = term_frequencies("cat cat dog")
    assert freqs == {"cat": 2, "dog": 1}
    assert total == 3


def test_more_occurrences_score_higher() -> None:
    # Same length, same term — the doc that mentions it more wins.
    scores = bm25_scores(
        postings=[(1, "database", 5), (2, "database", 1)],
        doc_len={1: 100, 2: 100},
        doc_freq={"database": 2},
        n_docs=2,
        avgdl=100,
    )
    assert scores[1] > scores[2] > 0


def test_shorter_document_scores_higher() -> None:
    # Same term frequency — the shorter doc is the more focused match.
    scores = bm25_scores(
        postings=[(1, "database", 1), (2, "database", 1)],
        doc_len={1: 50, 2: 200},
        doc_freq={"database": 2},
        n_docs=2,
        avgdl=125,
    )
    assert scores[1] > scores[2]
