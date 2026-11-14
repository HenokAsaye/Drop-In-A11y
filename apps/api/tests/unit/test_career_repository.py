from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.db.base import Base
from app.models import Career, Certificate
from app.repositories.careers import CareerRepository
from app.repositories.certificates import CertificateRepository

ISSUED_AT = datetime(2026, 1, 15, tzinfo=UTC)


@pytest.fixture
async def session(tmp_path: Path) -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/careers.db")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


def _certificate(certificate_id: str) -> Certificate:
    return Certificate(
        id=certificate_id,
        holder_name="Sara Bekele",
        course_title="Introduction to Networking",
        issuer="Savanna",
        issued_at=ISSUED_AT,
    )


async def test_list_returns_a_stable_page_and_the_total(session: AsyncSession) -> None:
    session.add_all(
        [
            _certificate("cert-1"),
            _certificate("cert-2"),
            Career(
                title="First",
                organization="Savanna",
                description="First role",
                application_url="https://jobs.example/first",
                certificate_id="cert-1",
            ),
            Career(
                title="Second",
                organization="Savanna",
                description="Second role",
                application_url="https://jobs.example/second",
                certificate_id="cert-2",
            ),
            Career(
                title="Third",
                organization="Savanna",
                description="Third role",
                application_url="https://jobs.example/third",
            ),
        ]
    )
    await session.commit()

    first_page, total = await CareerRepository(session).list(limit=2, offset=0)
    second_page, _ = await CareerRepository(session).list(limit=2, offset=2)

    assert total == 3
    assert [career.title for career in first_page] == ["First", "Second"]
    assert [career.title for career in second_page] == ["Third"]


async def test_get_certificate_returns_none_when_missing(session: AsyncSession) -> None:
    assert await CertificateRepository(session).get("missing-certificate") is None


async def test_get_certificate_returns_the_stored_row(session: AsyncSession) -> None:
    session.add(_certificate("cert-valid"))
    await session.commit()

    certificate = await CertificateRepository(session).get("cert-valid")

    assert certificate is not None
    assert certificate.holder_name == "Sara Bekele"
    assert certificate.revoked_at is None
