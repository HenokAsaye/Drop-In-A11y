from fastapi import APIRouter

from app.api.v1.routes import careers, certificates, lessons

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(lessons.router)
api_router.include_router(careers.router)
api_router.include_router(certificates.router)
