"""Tiny in-memory per-user rate limiter (sliding window).

Good enough for a single-process deployment; swap for Redis if the app ever
runs multiple workers.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, status

_hits: dict[tuple[int, str], deque[float]] = defaultdict(deque)


def check_rate_limit(user_id: int, key: str, limit: int, window_seconds: float) -> None:
    """Raise 429 if `user_id` exceeded `limit` calls to `key` within the window."""
    now = time.monotonic()
    q = _hits[(user_id, key)]
    while q and now - q[0] > window_seconds:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Rate limit exceeded — try again in a bit ({limit} per {int(window_seconds)}s).",
        )
    q.append(now)
