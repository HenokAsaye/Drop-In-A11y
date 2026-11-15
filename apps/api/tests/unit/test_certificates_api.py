from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401
from app.core.config import Settings
from app.db.base import Base
from app.db.session import get_session
from app.main import create_app
from app.models import Certificate

ISSUED_AT = datetime(2026, 1, 15, tzinfo=UTC)
REVOKED_AT = datetime(2026, 6, 1, tzinfo=UTC)


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/certificates.db")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        session.add_all(
            [
                Certificate(
                    id="cert-valid",
                    holder_name="Sara Bekele",
                    course_title="Introduction to Networking",
                    issuer="Savanna",
                    issued_at=ISSUED_AT,
                ),
                Certificate(
                    id="cert-revoked",
                    holder_name="Abel Tadesse",
                    course_title="Introduction to Networking",
                    issuer="Savanna",
                    issued_at=ISSUED_AT,
                    revoked_at=REVOKED_AT,
                ),
            ]
        )
        await session.commit()

    app = create_app(
        Settings(
            environment="test",
            media_base_url="https://media.example.com",
            public_api_url="https://api.example.com",
            cors_origins=["https://host.example"],
        )
    )

    async def override_session() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    await engine.dispose()


async def test_valid_certificate_state(client: AsyncClient) -> None:
    """A valid certificate returns 200, valid=True, status='valid' and full details."""
    response = await client.get("/api/v1/certificates/cert-valid/verify")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "cert-valid"
    assert body["valid"] is True
    assert body["status"] == "valid"
    assert body["holderName"] == "Sara Bekele"
    assert body["courseTitle"] == "Introduction to Networking"
    assert body["issuer"] == "Savanna"
    assert body["issuedAt"] is not None
    assert body["revokedAt"] is None


async def test_revoked_certificate_state(client: AsyncClient) -> None:
    """A revoked certificate returns 200, valid=False, status='revoked' with revocation date."""
    response = await client.get("/api/v1/certificates/cert-revoked/verify")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "cert-revoked"
    assert body["valid"] is False
    assert body["status"] == "revoked"
    assert body["holderName"] == "Abel Tadesse"
    assert body["courseTitle"] == "Introduction to Networking"
    assert body["issuer"] == "Savanna"
    assert body["issuedAt"] is not None
    assert body["revokedAt"] is not None


async def test_not_found_certificate_state(client: AsyncClient) -> None:
    """An unknown certificate returns 404 with not_found error response."""
    response = await client.get("/api/v1/certificates/cert-unknown/verify")

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert body["resource"] == "Certificate"
    assert "cert-unknown" in body["detail"]
