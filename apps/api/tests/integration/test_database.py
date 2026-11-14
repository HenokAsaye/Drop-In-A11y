"""Runs against a real PostgreSQL (SAVANNA_DATABASE_URL). CI provides one as a service container."""

from collections.abc import AsyncIterator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

import app.models  # noqa: F401
from app.core.config import Settings
from app.db.base import Base

pytestmark = pytest.mark.integration


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(Settings().database_url)
    yield engine
    await engine.dispose()


async def test_database_is_reachable(engine: AsyncEngine) -> None:
    async with engine.connect() as connection:
        assert (await connection.execute(text("SELECT 1"))).scalar_one() == 1


async def test_models_create_and_drop_cleanly(engine: AsyncEngine) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(Base.metadata.drop_all)
