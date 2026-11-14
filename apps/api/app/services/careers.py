from urllib.parse import quote

from app.models import Career
from app.repositories.careers import CareerRepository
from app.schemas.career import CareerOut, CareerPage
from app.services.urls import UrlBuilder


class CareerService:
    def __init__(self, careers: CareerRepository, urls: UrlBuilder) -> None:
        self._careers = careers
        self._urls = urls

    async def list_careers(self, *, limit: int, offset: int) -> CareerPage:
        items, total = await self._careers.list(limit=limit, offset=offset)
        return CareerPage(
            items=[self._to_career(career) for career in items],
            total=total,
            limit=limit,
            offset=offset,
        )

    def _to_career(self, career: Career) -> CareerOut:
        return CareerOut(
            id=career.id,
            title=career.title,
            organization=career.organization,
            description=career.description,
            location=career.location,
            application_url=career.application_url,
            audio_summary_url=self._urls.media(career.audio_summary_path),
            accommodations=career.accommodations,
            certificate_verification_url=self._verification_url(career.certificate_id),
        )

    def _verification_url(self, certificate_id: str | None) -> str | None:
        if not certificate_id:
            return None
        certificate = quote(certificate_id, safe="")
        return self._urls.api(f"/api/v1/certificates/{certificate}/verify")
