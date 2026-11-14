from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.errors import NotFoundError, register_exception_handlers


def _app() -> FastAPI:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/missing")
    async def missing() -> None:
        raise NotFoundError("Lesson", "unknown-lesson")

    @app.get("/pending")
    async def pending() -> None:
        raise NotImplementedError("LessonService.get_lesson")

    return app


async def test_not_found_maps_to_404() -> None:
    async with AsyncClient(transport=ASGITransport(app=_app()), base_url="http://test") as client:
        response = await client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "detail": "Lesson 'unknown-lesson' was not found",
        "code": "not_found",
        "resource": "Lesson",
    }


async def test_unimplemented_feature_maps_to_501() -> None:
    async with AsyncClient(transport=ASGITransport(app=_app()), base_url="http://test") as client:
        response = await client.get("/pending")

    assert response.status_code == 501
    assert response.json()["code"] == "not_implemented"
