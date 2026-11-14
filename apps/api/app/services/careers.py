from app.repositories.careers import CareerRepository
from app.schemas.career import CareerPage
from app.services.urls import UrlBuilder


class CareerService:
    def __init__(self, careers: CareerRepository, urls: UrlBuilder) -> None:
        self._careers = careers
        self._urls = urls

    async def list_careers(self, *, limit: int, offset: int) -> CareerPage:
        raise NotImplementedError("CareerService.list_careers")
