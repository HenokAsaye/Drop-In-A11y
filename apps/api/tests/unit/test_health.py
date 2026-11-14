from httpx import AsyncClient


async def test_health_reports_ok(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["environment"] == "test"


async def test_cors_allows_configured_host_site(client: AsyncClient) -> None:
    response = await client.options(
        "/health",
        headers={"Origin": "https://host.example", "Access-Control-Request-Method": "GET"},
    )

    assert response.headers["access-control-allow-origin"] == "https://host.example"


async def test_cors_rejects_unknown_origin(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers
