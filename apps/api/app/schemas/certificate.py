from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class CertificateVerificationOut(CamelModel):
    id: str
    valid: bool
    status: Literal["valid", "revoked"]
    holder_name: str
    course_title: str
    issuer: str
    issued_at: datetime
    revoked_at: datetime | None = None
