"""Routing table: which public /api prefix goes to which service."""

from fastapi import APIRouter, Depends, Request, Response

from gateway.config import get_settings
from gateway.proxy import forward
from gateway.security import get_current_user

# (public prefix, service name, Settings attribute holding the service URL, token required at the gateway)
ROUTES: list[tuple[str, str, str, bool]] = [
    ("/api/auth", "auth-service", "auth_service_url", False),
    ("/api/users", "auth-service", "auth_service_url", True),
    ("/api/topics", "learning-service", "learning_service_url", True),
    ("/api/questions", "learning-service", "learning_service_url", True),
    ("/api/practice", "learning-service", "learning_service_url", True),
    ("/api/vocabularies", "learning-service", "learning_service_url", True),
    ("/api/streak", "learning-service", "learning_service_url", True),
    ("/api/ranking", "learning-service", "learning_service_url", True),
]

METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


def _make_handler(prefix: str, service: str, url_setting: str):
    downstream_prefix = prefix.removeprefix("/api")  # /api/users/me -> /users/me

    async def handler(request: Request) -> Response:
        rest = request.path_params.get("path", "")
        path = f"{downstream_prefix}/{rest}" if rest else downstream_prefix
        return await forward(request, service, getattr(get_settings(), url_setting), path)

    return handler


def build_router() -> APIRouter:
    router = APIRouter()
    for prefix, service, url_setting, protected in ROUTES:
        handler = _make_handler(prefix, service, url_setting)
        dependencies = [Depends(get_current_user)] if protected else []
        for route_path in (prefix, f"{prefix}/{{path:path}}"):
            router.add_api_route(
                route_path, handler, methods=METHODS, dependencies=dependencies, include_in_schema=False
            )
    return router
