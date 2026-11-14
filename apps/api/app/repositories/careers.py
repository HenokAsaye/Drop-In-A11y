from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Career


class CareerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, *, limit: int, offset: int) -> tuple[Sequence[Career], int]:
        """Return one page of careers and the total count."""
        raise NotImplementedError("CareerRepository.list")
