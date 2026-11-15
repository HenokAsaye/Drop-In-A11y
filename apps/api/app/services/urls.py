from urllib.parse import urljoin, urlsplit

from app.core.urls import is_web_url


class UrlBuilder:
    """Turns stored relative paths into public URLs for media storage and the API itself."""

    def __init__(self, media_base_url: str, public_api_url: str) -> None:
        self._media_base = media_base_url.rstrip("/") + "/"
        self._api_base = public_api_url.rstrip("/") + "/"

    def media(self, path: str | None) -> str | None:
        """Resolve a storage path against the media base URL.

        Absolute http(s) URLs pass through; any other scheme is dropped so it never reaches a page.
        """
        if not path:
            return None
        if urlsplit(path).scheme:
            return path if is_web_url(path) else None
        return urljoin(self._media_base, path.lstrip("/"))

    def api(self, path: str) -> str:
        return urljoin(self._api_base, path.lstrip("/"))
