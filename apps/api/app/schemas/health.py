from typing import Literal

from app.schemas.common import CamelModel


class HealthOut(CamelModel):
    status: Literal["ok"]
    version: str
    environment: str
