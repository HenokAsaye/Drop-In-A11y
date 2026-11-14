from importlib.metadata import PackageNotFoundError, version

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.schemas.health import HealthOut

try:
    APP_VERSION = version("savanna-api")
except PackageNotFoundError:
    APP_VERSION = "0.1.0"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=APP_VERSION,
        description="Lesson, resource, career and certificate metadata for Savanna BridgePlayer.",
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )

    # The plugin is embedded on third-party sites, so CORS is an explicit allow-list.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.state.settings = settings

    @app.get("/health", response_model=HealthOut, tags=["health"])
    async def health() -> HealthOut:
        return HealthOut(status="ok", version=APP_VERSION, environment=settings.environment)

    app.include_router(api_router)
    return app


app = create_app()
