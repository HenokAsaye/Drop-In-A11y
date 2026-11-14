from app.schemas.common import CamelModel


class CareerOut(CamelModel):
    id: int
    title: str
    organization: str
    description: str
    location: str | None = None
    application_url: str
    audio_summary_url: str | None = None
    accommodations: str | None = None
    certificate_verification_url: str | None = None


class CareerPage(CamelModel):
    items: list[CareerOut]
    total: int
    limit: int
    offset: int
