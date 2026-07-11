"""Unit tests for the collection-suggestions scraper (no network)."""
from app.services.suggest import build_query, parse_results

_DDG_HTML = """
<html><body>
<div class="result">
  <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpost&rut=x">
    Example Post
  </a>
  <a class="result__snippet">A snippet about the post.</a>
</div>
<div class="result">
  <a class="result__a" href="https://direct.example.org/page">Direct Result</a>
</div>
<div class="result"><span>no link here</span></div>
</body></html>
"""


def test_parse_results_unwraps_ddg_redirects() -> None:
    results = parse_results(_DDG_HTML)
    assert results[0]["url"] == "https://example.com/post"
    assert results[0]["title"] == "Example Post"
    assert results[0]["snippet"] == "A snippet about the post."
    assert results[1]["url"] == "https://direct.example.org/page"
    assert len(results) == 2


def test_build_query_uses_name_and_top_tags() -> None:
    q = build_query("Rust learning", ["t1", "t2"], ["rust", "rust", "wasm", "cli"])
    assert q.startswith("Rust learning")
    assert "rust" in q and "wasm" in q


def test_build_query_falls_back_to_title() -> None:
    q = build_query("Reading", ["Understanding PostgreSQL Indexing deep dive"], [])
    assert "Understanding PostgreSQL" in q
