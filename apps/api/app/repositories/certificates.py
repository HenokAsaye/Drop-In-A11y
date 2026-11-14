from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Certificate


class CertificateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, certificate_id: str) -> Certificate | None:
        raise NotImplementedError("CertificateRepository.get")
