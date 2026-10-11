import httpx
import respx


@respx.mock
def test_service_spec_is_rewritten_to_go_through_the_gateway(client):
    respx.get("http://auth.test/v3/api-docs").mock(
        return_value=httpx.Response(
            200,
            json={
                "openapi": "3.1.0",
                "servers": [{"url": "http://auth-service:8081"}],
                "paths": {"/auth/login": {}, "/users/{id}": {}, "/usersx": {}, "/.well-known/jwks.json": {}},
            },
        )
    )

    response = client.get("/api/docs/auth-service.json")

    assert response.status_code == 200
    spec = response.json()
    assert [server["url"] for server in spec["servers"]] == ["/api"]
    # only what the gateway routes to auth-service: /api/auth, /api/users and below
    assert set(spec["paths"]) == {"/auth/login", "/users/{id}"}


@respx.mock
def test_learning_spec_keeps_only_routed_paths(client):
    respx.get("http://learning.test/openapi.json").mock(
        return_value=httpx.Response(
            200, json={"openapi": "3.1.0", "paths": {"/health": {}, "/topics": {}, "/internal/report": {}, "/ranking/weekly": {}}}
        )
    )

    paths = client.get("/api/docs/learning-service.json").json()["paths"]

    assert set(paths) == {"/topics", "/ranking/weekly"}


def test_unknown_service_spec_is_404(client):
    response = client.get("/api/docs/payment-service.json")

    assert response.status_code == 404
    assert response.json()["message"] == "No API description for payment-service"


@respx.mock
def test_spec_of_a_stopped_service_is_502(client):
    respx.get("http://learning.test/openapi.json").mock(side_effect=httpx.ConnectError("connection refused"))

    response = client.get("/api/docs/learning-service.json")

    assert response.status_code == 502
    assert response.json()["message"] == "learning-service is unavailable"


def test_swagger_page_lists_every_service(client):
    for path in ("/docs", "/api/docs"):
        page = client.get(path)
        assert page.status_code == 200
        for service in ("auth-service", "learning-service"):
            assert f"/api/docs/{service}.json" in page.text
        assert "StandaloneLayout" in page.text
        assert "swagger-ui-standalone-preset.js" in page.text
        assert '"displayRequestDuration": true,\n  "presets"' in page.text  # the settings stay valid JavaScript


def test_gateway_spec_uses_the_shared_bearer_scheme(client):
    spec = client.get("/api/openapi.json").json()

    assert set(spec["components"]["securitySchemes"]) == {"bearerAuth"}
    assert "/api/dashboard/student" in spec["paths"]
