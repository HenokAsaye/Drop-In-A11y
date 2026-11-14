"""The endpoint table in the specification (section 6) is the public contract."""

import pytest
from fastapi import FastAPI

SPEC_ENDPOINTS = [
    "/api/v1/lessons/{lesson_id}",
    "/api/v1/lessons/{lesson_id}/transcript",
    "/api/v1/lessons/{lesson_id}/captions",
    "/api/v1/lessons/{lesson_id}/offline",
    "/api/v1/lessons/{lesson_id}/documents",
    "/api/v1/careers",
    "/api/v1/certificates/{certificate_id}/verify",
]


@pytest.mark.parametrize("path", SPEC_ENDPOINTS)
def test_spec_endpoint_is_exposed_as_get(app: FastAPI, path: str) -> None:
    paths = app.openapi()["paths"]

    assert path in paths
    assert "get" in paths[path]


def test_lesson_schema_uses_camel_case_wire_format(app: FastAPI) -> None:
    media = app.openapi()["components"]["schemas"]["MediaSources"]["properties"]

    assert {"video", "audio", "signLanguage", "audioDescription"} <= media.keys()
