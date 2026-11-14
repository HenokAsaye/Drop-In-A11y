from app.core.errors import NotFoundError
from app.repositories.certificates import CertificateRepository
from app.schemas.certificate import CertificateVerificationOut


class CertificateService:
    def __init__(self, certificates: CertificateRepository) -> None:
        self._certificates = certificates

    async def verify(self, certificate_id: str) -> CertificateVerificationOut:
        certificate = await self._certificates.get(certificate_id)
        if certificate is None:
            raise NotFoundError("Certificate", certificate_id)
        revoked = certificate.revoked_at is not None
        return CertificateVerificationOut(
            id=certificate.id,
            valid=not revoked,
            status="revoked" if revoked else "valid",
            holder_name=certificate.holder_name,
            course_title=certificate.course_title,
            issuer=certificate.issuer,
            issued_at=certificate.issued_at,
            revoked_at=certificate.revoked_at,
        )
