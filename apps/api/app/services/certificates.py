from app.repositories.certificates import CertificateRepository
from app.schemas.certificate import CertificateVerificationOut


class CertificateService:
    def __init__(self, certificates: CertificateRepository) -> None:
        self._certificates = certificates

    async def verify(self, certificate_id: str) -> CertificateVerificationOut:
        raise NotImplementedError("CertificateService.verify")
