"""Pluggable page summarizer.

Default is Claude (Haiku) when ANTHROPIC_API_KEY is set; otherwise a dependency-
free extractive fallback (first few sentences) so the pipeline always runs.
Swapping in a local LLM later means adding one more class here.
"""
import re
from typing import Protocol, runtime_checkable

import anthropic

from app.config import settings

_SYSTEM_PROMPT = (
    "You summarize saved web pages for a personal search engine. Write a factual "
    "2-3 sentence summary capturing the main point and why someone saved it. "
    "Respond with the summary only — no preamble, no 'Here is'."
)


@runtime_checkable
class Summarizer(Protocol):
    async def summarize(self, title: str, text: str) -> str: ...


def _extractive(text: str, max_sentences: int = 3) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(s for s in sentences[:max_sentences] if s).strip()


class ExtractiveSummarizer:
    """Zero-dependency fallback: the first few sentences of the article."""

    async def summarize(self, title: str, text: str) -> str:
        return _extractive(text)


class ClaudeSummarizer:
    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def summarize(self, title: str, text: str) -> str:
        excerpt = text[:12000]
        try:
            resp = await self._client.messages.create(
                model=settings.anthropic_model,
                max_tokens=settings.summary_max_tokens,
                system=_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": f"Title: {title}\n\n{excerpt}"}],
            )
        except anthropic.APIError:
            # Network/quota/refusal — degrade rather than fail the whole save.
            return _extractive(text)
        summary = "".join(b.text for b in resp.content if b.type == "text").strip()
        return summary or _extractive(text)


def get_summarizer() -> Summarizer:
    return ClaudeSummarizer() if settings.anthropic_configured else ExtractiveSummarizer()
