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
from app.models import Career, Certificate

ISSUED_AT = datetime(2026, 1, 15, tzinfo=UTC)
REVOKED_AT = datetime(2026, 6, 1, tzinfo=UTC)


@pytest.fixture
async def client(tmp_path: Path) -> AsyncIterator[AsyncClient]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path}/careers.db")
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
                Career(
                    title="Network technician",
                    organization="Savanna Labs",
                    description="Install and support campus networks.",
                    location="Addis Ababa",
                    application_url="https://jobs.example/network-technician",
                    audio_summary_path="careers/network-technician.mp3",
                    accommodations="Sign language interpretation is available on request.",
                    certificate_id="cert-valid",
                ),
                Career(
                    title="Support specialist",
                    organization="Savanna Labs",
                    description="Help learners use accessible course tools.",
                    application_url="https://jobs.example/support",
                    certificate_id="cert-revoked",
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


async def test_careers_page_returns_camel_case_urls(client: AsyncClient) -> None:
    response = await client.get("/api/v1/careers", params={"limit": 1, "offset": 0})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert body["limit"] == 1
    assert body["offset"] == 0
    assert body["items"] == [
        {
            "id": 1,
            "title": "Network technician",
            "organization": "Savanna Labs",
            "description": "Install and support campus networks.",
            "location": "Addis Ababa",
            "applicationUrl": "https://jobs.example/network-technician",
            "audioSummaryUrl": "https://media.example.com/careers/network-technician.mp3",
            "accommodations": "Sign language interpretation is available on request.",
            "certificateVerificationUrl": "https://api.example.com/api/v1/certificates/cert-valid/verify",
        }
    ]


async def test_second_career_page_has_no_audio_summary(client: AsyncClient) -> None:
    response = await client.get("/api/v1/careers", params={"limit": 1, "offset": 1})

    item = response.json()["items"][0]
    assert item["title"] == "Support specialist"
    assert item["audioSummaryUrl"] is None
    assert item["location"] is None
    assert (
        item["certificateVerificationUrl"]
        == "https://api.example.com/api/v1/certificates/cert-revoked/verify"
    )


async def test_valid_certificate_verification(client: AsyncClient) -> None:
    response = await client.get("/api/v1/certificates/cert-valid/verify")

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["status"] == "valid"
    assert body["holderName"] == "Sara Bekele"
    assert body["courseTitle"] == "Introduction to Networking"
    assert body["revokedAt"] is None


async def test_revoked_certificate_verification(client: AsyncClient) -> None:
    response = await client.get("/api/v1/certificates/cert-revoked/verify")

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert body["status"] == "revoked"
    assert body["revokedAt"] is not None


async def test_unknown_certificate_is_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/certificates/missing-certificate/verify")

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Certificate 'missing-certificate' was not found",
        "code": "not_found",
        "resource": "Certificate",
    }
