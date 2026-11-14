from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.db.session import get_session
from app.repositories.careers import CareerRepository
from app.repositories.certificates import CertificateRepository
from app.repositories.lessons import LessonRepository
from app.services.careers import CareerService
from app.services.certificates import CertificateService
from app.services.lessons import LessonService
from app.services.urls import UrlBuilder


def get_app_settings(request: Request) -> Settings:
    settings = getattr(request.app.state, "settings", None)
    if not isinstance(settings, Settings):
        raise RuntimeError("application settings were not configured")
    return settings


SettingsDep = Annotated[Settings, Depends(get_app_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_url_builder(settings: SettingsDep) -> UrlBuilder:
    return UrlBuilder(settings.media_base_url, settings.public_api_url)


UrlBuilderDep = Annotated[UrlBuilder, Depends(get_url_builder)]


def get_lesson_service(session: SessionDep, urls: UrlBuilderDep) -> LessonService:
    return LessonService(LessonRepository(session), urls)


def get_career_service(session: SessionDep, urls: UrlBuilderDep) -> CareerService:
    return CareerService(CareerRepository(session), urls)


def get_certificate_service(session: SessionDep) -> CertificateService:
    return CertificateService(CertificateRepository(session))


LessonServiceDep = Annotated[LessonService, Depends(get_lesson_service)]
CareerServiceDep = Annotated[CareerService, Depends(get_career_service)]
CertificateServiceDep = Annotated[CertificateService, Depends(get_certificate_service)]
