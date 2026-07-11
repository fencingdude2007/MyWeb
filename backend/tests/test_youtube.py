from app.services.youtube import extract_video_id, is_youtube


def test_extract_video_id_from_watch_url() -> None:
    assert extract_video_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_extract_video_id_from_short_and_embed_urls() -> None:
    assert extract_video_id("https://youtu.be/dQw4w9WgXcQ?t=10") == "dQw4w9WgXcQ"
    assert extract_video_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert extract_video_id("https://www.youtube.com/shorts/dQw4w9WgXcQ") == "dQw4w9WgXcQ"


def test_is_youtube() -> None:
    assert is_youtube("https://youtu.be/dQw4w9WgXcQ")
    assert not is_youtube("https://example.com/watch?v=dQw4w9WgXcQ")
    assert not is_youtube("https://www.youtube.com/feed/subscriptions")
