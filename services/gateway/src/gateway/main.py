from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gateway import requestid
from gateway.config import get_settings
from gateway.dashboard import router as dashboard_router
from gateway.docs import router as docs_router
from gateway.errors import register_error_handlers
from gateway.routes import build_router

requestid.setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # One shared HTTP client (connection pool) for every call to the services
    async with httpx.AsyncClient(timeout=get_settings().request_timeout_seconds) as client:
        app.state.http = client
        yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="NamBeDe API Gateway",
        description="Cửa vào duy nhất của client: kiểm tra JWT, chuyển /api/* tới đúng service, "
        "gộp dữ liệu cho dashboard. Chọn service ở menu phía trên để xem và thử API của từng service.",
        version="0.1.0",
        lifespan=lifespan,
        # Swagger of the whole system is served by gateway.docs; this is the gateway's own document
        docs_url=None,
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # Readable from the browser's JavaScript: the request id to quote in a bug report, the download's file name
        expose_headers=[requestid.HEADER, "Content-Disposition", "Retry-After"],
    )
    register_error_handlers(app)
    requestid.install(app)

    @app.get("/api/health", tags=["Hệ thống"], summary="Gateway còn chạy không (không cần token)")
    def health() -> dict[str, str]:
        return {"status": "UP", "service": "gateway"}

    app.include_router(docs_router)
    app.include_router(dashboard_router)
    app.include_router(build_router())
    return app


app = create_app()
