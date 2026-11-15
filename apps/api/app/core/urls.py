"""Rules for stored values that reach a learner's browser as a link or a media source."""

from urllib.parse import urlsplit

WEB_SCHEMES = frozenset({"http", "https"})


def is_web_url(value: str) -> bool:
    """True for an absolute http or https URL with a host."""
    parts = urlsplit(value.strip())
    return parts.scheme.lower() in WEB_SCHEMES and bool(parts.netloc)


def require_web_url(value: str) -> str:
    """Refuse anything but an absolute http or https URL, so `javascript:` is never stored."""
    if not is_web_url(value):
        raise ValueError(f"Expected an absolute http or https URL, got {value!r}")
    return value


def require_media_path(value: str | None) -> str | None:
    """Accept a storage path or an absolute http or https URL; refuse other schemes."""
    if value is None or not urlsplit(value.strip()).scheme:
        return value
    return require_web_url(value)
