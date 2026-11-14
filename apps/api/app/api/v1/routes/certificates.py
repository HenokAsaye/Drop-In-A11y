from typing import Annotated

from fastapi import APIRouter, Path

from app.api.deps import CertificateServiceDep
from app.schemas.certificate import CertificateVerificationOut
from app.schemas.common import ErrorResponse

router = APIRouter(prefix="/certificates", tags=["certificates"])


@router.get(
    "/{certificate_id}/verify",
    response_model=CertificateVerificationOut,
    responses={404: {"model": ErrorResponse}},
)
async def verify_certificate(
    certificate_id: Annotated[str, Path(min_length=1, max_length=64)],
    service: CertificateServiceDep,
) -> CertificateVerificationOut:
    """Verify that a certificate was issued and has not been revoked."""
    return await service.verify(certificate_id)
