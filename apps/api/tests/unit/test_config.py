import pytest

from app.core.config import Settings


def test_cors_origins_parse_comma_separated_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAVANNA_CORS_ORIGINS", "https://a.example, https://b.example ,")

    assert Settings().cors_origins == ["https://a.example", "https://b.example"]


def test_production_flag() -> None:
    assert Settings(environment="production").is_production
    assert not Settings(environment="development").is_production
