from urllib.parse import urljoin, urlsplit


class UrlBuilder:
    """Turns stored relative paths into public URLs for media storage and the API itself."""

    def __init__(self, media_base_url: str, public_api_url: str) -> None:
        self._media_base = media_base_url.rstrip("/") + "/"
        self._api_base = public_api_url.rstrip("/") + "/"

    def media(self, path: str | None) -> str | None:
        """Resolve a storage path against the media base URL; absolute URLs pass through."""
        if not path:
            return None
        if urlsplit(path).scheme:
            return path
        return urljoin(self._media_base, path.lstrip("/"))

    def api(self, path: str) -> str:
        return urljoin(self._api_base, path.lstrip("/"))
