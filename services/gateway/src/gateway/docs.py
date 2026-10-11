"""Swagger for the whole system: one page at /docs (and /api/docs) with a definition per service.

Each service's OpenAPI document is fetched through the gateway and rewritten so that "Try it out" calls the gateway,
the way every client does: the server becomes /api and only the paths the gateway routes are kept.
"""

import json

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse

from gateway.config import get_settings
from gateway.errors import GatewayError
from gateway.routes import ROUTES

# service -> (Settings attribute holding its URL, where it serves its OpenAPI document, name in the Swagger menu)
SPECS: dict[str, tuple[str, str, str]] = {
    "auth-service": ("auth_service_url", "/v3/api-docs", "Auth Service: đăng nhập, người dùng"),
    "learning-service": ("learning_service_url", "/openapi.json", "Learning Service: câu hỏi, luyện tập, từ vựng, xếp hạng"),
}

SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5"
# The standard swagger-ui-dist page. The standalone preset (a separate script) draws the definition menu at the top.
PAGE = """<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NamBeDe API</title>
<link rel="stylesheet" href="{ui}/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="{ui}/swagger-ui-bundle.js"></script>
<script src="{ui}/swagger-ui-standalone-preset.js"></script>
<script>
window.ui = SwaggerUIBundle({config})
</script>
</body>
</html>
"""

router = APIRouter(include_in_schema=False)


def routed_prefixes(service: str) -> list[str]:
    """The paths of a service that the gateway exposes, e.g. /auth and /users for auth-service."""
    return [prefix.removeprefix("/api") for prefix, name, _, _ in ROUTES if name == service]


@router.get("/api/docs/{service}.json")
async def service_spec(service: str, request: Request) -> JSONResponse:
    if service not in SPECS:
        raise GatewayError(404, f"No API description for {service}")
    url_setting, path, _ = SPECS[service]
    try:
        upstream = await request.app.state.http.get(getattr(get_settings(), url_setting) + path)
        upstream.raise_for_status()
        spec = upstream.json()
    except (httpx.HTTPError, ValueError):
        raise GatewayError(502, f"{service} is unavailable") from None
    prefixes = routed_prefixes(service)
    # Internal endpoints (e.g. /health) are not reachable through the gateway: leave them out
    spec["paths"] = {
        path: item
        for path, item in spec.get("paths", {}).items()
        if any(path == prefix or path.startswith(prefix + "/") for prefix in prefixes)
    }
    spec["servers"] = [{"url": "/api", "description": "Qua API Gateway, như mọi client gọi"}]
    return JSONResponse(spec)


@router.get("/docs")
@router.get("/api/docs")
async def swagger_ui() -> HTMLResponse:
    """Swagger UI with a menu at the top: the gateway's own API, then each service."""
    urls = [{"url": "/api/openapi.json", "name": "API Gateway: health, dashboard (BFF)"}]
    urls += [{"url": f"/api/docs/{service}.json", "name": name} for service, (_, _, name) in SPECS.items()]
    config = {
        "urls": urls,
        "urls.primaryName": urls[1]["name"],  # open on Auth Service, where you log in
        "dom_id": "#swagger-ui",
        "layout": "StandaloneLayout",  # the layout with the definition menu
        "deepLinking": True,
        "persistAuthorization": True,  # one token for every definition, kept after a reload
        "displayRequestDuration": True,
    }
    # JSON for the plain settings, then the two JavaScript references that JSON cannot hold
    settings = json.dumps(config, ensure_ascii=False, indent=2).removesuffix("\n}")
    script = (settings + ',\n  "presets": [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],'
              '\n  "plugins": [SwaggerUIBundle.plugins.DownloadUrl]\n}')
    return HTMLResponse(PAGE.format(ui=SWAGGER_UI, config=script))
