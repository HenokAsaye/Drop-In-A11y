from datetime import UTC, datetime

import pytest

from app.core.errors import NotFoundError
from app.models import Career, Certificate
from app.repositories.careers import CareerRepository
from app.repositories.certificates import CertificateRepository
from app.services.careers import CareerService
from app.services.certificates import CertificateService
from app.services.urls import UrlBuilder

ISSUED_AT = datetime(2026, 1, 15, tzinfo=UTC)
REVOKED_AT = datetime(2026, 6, 1, tzinfo=UTC)


class FakeCareerRepository(CareerRepository):
    def __init__(self, careers: list[Career]) -> None:
        self._items = careers

    async def list(self, *, limit: int, offset: int) -> tuple[list[Career], int]:
        return self._items[offset : offset + limit], len(self._items)


class FakeCertificateRepository(CertificateRepository):
    def __init__(self, certificates: dict[str, Certificate]) -> None:
        self._items = certificates

    async def get(self, certificate_id: str) -> Certificate | None:
        return self._items.get(certificate_id)


def career_service(*careers: Career) -> CareerService:
    urls = UrlBuilder("https://media.example.com", "https://api.example.com")
    return CareerService(FakeCareerRepository(list(careers)), urls)


def certificate_service(*certificates: Certificate) -> CertificateService:
    return CertificateService(FakeCertificateRepository({item.id: item for item in certificates}))


def _career(**overrides: object) -> Career:
    values: dict[str, object] = {
        "id": 1,
        "title": "Network technician",
        "organization": "Savanna Labs",
        "description": "Install and support campus networks.",
        "location": "Addis Ababa",
        "application_url": "https://jobs.example/network-technician",
        "audio_summary_path": "careers/network-technician.mp3",
        "accommodations": "Sign language interpretation is available on request.",
        "certificate_id": "cert-valid",
    }
    values.update(overrides)
    return Career(**values)


def _certificate(**overrides: object) -> Certificate:
    values: dict[str, object] = {
        "id": "cert-valid",
        "holder_name": "Sara Bekele",
        "course_title": "Introduction to Networking",
        "issuer": "Savanna",
        "issued_at": ISSUED_AT,
        "revoked_at": None,
    }
    values.update(overrides)
    return Certificate(**values)


async def test_career_page_uses_public_urls_not_stored_paths() -> None:
    page = await career_service(_career()).list_careers(limit=20, offset=0)
    career = page.items[0]

    assert page.total == 1
    assert page.limit == 20
    assert page.offset == 0
    dumped = career.model_dump(by_alias=True)
    assert dumped["audioSummaryUrl"] == "https://media.example.com/careers/network-technician.mp3"
    assert (
        dumped["certificateVerificationUrl"]
        == "https://api.example.com/api/v1/certificates/cert-valid/verify"
    )
    assert dumped["applicationUrl"] == "https://jobs.example/network-technician"
    assert dumped["certificateVerificationUrl"] != dumped["applicationUrl"]


async def test_career_without_audio_or_certificate_omits_those_urls() -> None:
    page = await career_service(
        _career(audio_summary_path=None, certificate_id=None, accommodations=None, location=None)
    ).list_careers(limit=20, offset=0)

    career = page.items[0].model_dump(by_alias=True)
    assert career["audioSummaryUrl"] is None
    assert career["certificateVerificationUrl"] is None


async def test_career_page_respects_limit_and_offset() -> None:
    careers = [_career(id=index, title=f"Role {index}") for index in (1, 2, 3)]

    page = await career_service(*careers).list_careers(limit=1, offset=1)

    assert page.total == 3
    assert [item.id for item in page.items] == [2]


async def test_certificate_id_is_encoded_in_the_verification_url() -> None:
    page = await career_service(_career(certificate_id="cert/1")).list_careers(limit=20, offset=0)

    assert (
        page.items[0].certificate_verification_url
        == "https://api.example.com/api/v1/certificates/cert%2F1/verify"
    )


async def test_valid_certificate_is_not_revoked() -> None:
    result = await certificate_service(_certificate()).verify("cert-valid")

    assert result.valid is True
    assert result.status == "valid"
    assert result.revoked_at is None
    assert result.model_dump(by_alias=True)["holderName"] == "Sara Bekele"


async def test_revoked_certificate_is_not_valid() -> None:
    revoked = _certificate(id="cert-revoked", revoked_at=REVOKED_AT)

    result = await certificate_service(revoked).verify("cert-revoked")

    assert result.valid is False
    assert result.status == "revoked"
    assert result.revoked_at == REVOKED_AT


async def test_unknown_certificate_raises_not_found() -> None:
    with pytest.raises(NotFoundError) as raised:
        await certificate_service().verify("missing-certificate")

    assert raised.value.resource == "Certificate"
    assert raised.value.identifier == "missing-certificate"
