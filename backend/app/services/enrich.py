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
    # Pronouns / vague fillers that make useless tags — never emit these.
    "i", "me", "my", "mine", "us", "him", "hers", "them", "who", "whom", "whose",
    "something", "anything", "everything", "nothing", "someone", "anyone",
    "everyone", "people", "thing", "things", "way", "ways", "time", "times",
    "one", "ones", "other", "others", "some", "any", "all", "more", "most",
    "here", "there", "when", "where", "why", "also", "just", "very", "much",
    "many", "such", "own", "same", "each", "both", "few", "lot", "lots", "bit",
    "part", "kind", "sort", "type", "example", "case", "point", "fact", "today",
    "yesterday", "tomorrow", "year", "years", "day", "days", "week", "weeks",
    "article", "page", "post", "site", "website", "home", "menu", "search",
    "click", "read", "share", "comments", "reply", "email", "password", "login",
    "sign", "cookie", "cookies", "privacy", "terms", "copyright", "rights",
    # Generic verbs-as-nouns and listicle filler.
    "use", "uses", "user", "users", "get", "gets", "make", "makes", "need",
    "needs", "want", "wants", "guide", "guides", "tip", "tips", "best", "top",
    "new", "free", "online", "review", "reviews", "list", "lists", "step",
    "steps", "number", "numbers", "content", "information", "data", "story",
    "stories", "news", "update", "updates", "version", "link", "links",
    "video", "videos", "image", "images", "photo", "photos", "world", "life",
    "work", "end", "start", "place", "places", "name", "names", "word", "words",
}

# Chunks rooted in these parts of speech are grammatical filler, not topics.
_BAD_ROOT_POS = {"PRON", "DET", "NUM", "AUX", "ADV", "PART"}

# Entity labels that make good, specific tags (people, orgs, places, products…).
_TAGGABLE_ENT_LABELS = {
    "PERSON", "ORG", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART",
    "LANGUAGE", "NORP", "FAC", "LAW",
}


def _clean_phrase(tokens) -> str | None:
    """Reduce a noun chunk to its content words; None if nothing specific is left."""
    words = [
        t.text.lower()
        for t in tokens
        if t.pos_ not in ("DET", "PRON", "PART", "PUNCT", "SPACE", "SYM")
        and t.text.lower() not in _STOPWORDS
        and not t.is_digit
    ]
    phrase = " ".join(words).strip("-— '\"")
    if not (2 < len(phrase) < 40):
        return None
    if not re.search(r"[a-z]", phrase):
        return None
    if all(w in _STOPWORDS for w in phrase.split()):
        return None
    return phrase


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

    # Candidate tags, scored by frequency. Noun chunks are reduced to their
    # content words (no "the", no pronoun chunks like "you"/"this"); named
    # entities get double weight because they're inherently specific.
    scores: Counter[str] = Counter()
    from_entity: set[str] = set()
    for chunk in doc.noun_chunks:
        if chunk.root.pos_ in _BAD_ROOT_POS:
            continue
        phrase = _clean_phrase(chunk)
        if phrase:
            scores[phrase] += 1
    for ent in doc.ents:
        if ent.label_ not in _TAGGABLE_ENT_LABELS:
            continue
        phrase = _clean_phrase(ent)
        if phrase:
            scores[phrase] += 2
            from_entity.add(phrase)

    # A generic single word that appears once is noise; entities and multiword
    # phrases are specific enough to keep on a single mention. Fewer, better.
    keywords = [
        kw
        for kw, score in scores.most_common(24)
        if " " in kw or kw in from_entity or score >= 2
    ][:6] or _fallback_keywords(excerpt, top_n=6)
    return keywords, entities[:30]
