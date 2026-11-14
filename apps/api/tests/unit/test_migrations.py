import sqlite3
from pathlib import Path

import pytest
from alembic.config import Config

from alembic import command
from app.core.config import get_settings

API_ROOT = Path(__file__).resolve().parents[2]
TABLES = {
    "lessons",
    "caption_tracks",
    "transcripts",
    "lesson_documents",
    "certificates",
    "careers",
}


def _config() -> Config:
    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "alembic"))
    return config


def _tables(database: Path) -> set[str]:
    with sqlite3.connect(database) as connection:
        rows = connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
        return {name for (name,) in rows}


def test_alembic_upgrade_head_creates_and_downgrades_the_schema(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database = tmp_path / "savanna.db"
    monkeypatch.setenv("SAVANNA_DATABASE_URL", f"sqlite+aiosqlite:///{database}")
    get_settings.cache_clear()
    config = _config()
    try:
        command.upgrade(config, "head")
        assert _tables(database) >= TABLES

        command.downgrade(config, "base")
        assert _tables(database) == {"alembic_version"}

        command.upgrade(config, "head")
        assert _tables(database) >= TABLES
    finally:
        get_settings.cache_clear()
