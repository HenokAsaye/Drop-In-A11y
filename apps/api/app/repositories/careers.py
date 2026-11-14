from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Career


class CareerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, *, limit: int, offset: int) -> tuple[Sequence[Career], int]:
        """Return one page of careers, ordered by id, and the total count."""
        total = await self._session.scalar(select(func.count()).select_from(Career)) or 0
        stmt = select(Career).order_by(Career.id).limit(limit).offset(offset)
        items = (await self._session.scalars(stmt)).all()
        return items, total
