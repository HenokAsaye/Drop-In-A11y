from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import CareerServiceDep
from app.schemas.career import CareerPage

router = APIRouter(prefix="/careers", tags=["careers"])


@router.get("", response_model=CareerPage)
async def list_careers(
    service: CareerServiceDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CareerPage:
    """Accessible career opportunities."""
    return await service.list_careers(limit=limit, offset=offset)
