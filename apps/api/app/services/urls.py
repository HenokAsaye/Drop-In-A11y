class UrlBuilder:
    """Turns stored relative paths into public URLs for media storage and the API itself."""

    def __init__(self, media_base_url: str, public_api_url: str) -> None:
        self._media_base_url = media_base_url
        self._public_api_url = public_api_url

    def media(self, path: str | None) -> str | None:
        """Resolve a storage path against the media base URL; absolute URLs pass through."""
        raise NotImplementedError("UrlBuilder.media")

    def api(self, path: str) -> str:
        raise NotImplementedError("UrlBuilder.api")
