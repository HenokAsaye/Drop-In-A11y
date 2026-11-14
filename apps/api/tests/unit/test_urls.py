"""Specification tests for media URL resolution (spec 2.1, 6): the API returns URLs, never bytes."""

import pytest

from app.services.urls import UrlBuilder


@pytest.fixture
def urls() -> UrlBuilder:
    return UrlBuilder("https://media.example/", "https://api.example")


def test_relative_media_path_resolves_against_storage(urls: UrlBuilder) -> None:
    assert urls.media("/media/networking.mp4") == "https://media.example/media/networking.mp4"


def test_absolute_media_url_passes_through(urls: UrlBuilder) -> None:
    assert urls.media("https://cdn.example/a.mp4") == "https://cdn.example/a.mp4"


def test_missing_media_path_stays_missing(urls: UrlBuilder) -> None:
    assert urls.media(None) is None


def test_api_path_resolves_against_public_api_url(urls: UrlBuilder) -> None:
    assert urls.api("/api/v1/lessons/x") == "https://api.example/api/v1/lessons/x"
