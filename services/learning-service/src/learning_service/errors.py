"""Errors use the same body as every NamBeDe service: {"status", "error", "message", "path"}."""

import logging
from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def error_response(status: int, message: str, path: str) -> JSONResponse:
    body = {"status": status, "error": HTTPStatus(status).phrase, "message": message, "path": path}
    headers = {"WWW-Authenticate": "Bearer"} if status == 401 else None
    return JSONResponse(status_code=status, content=body, headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return error_response(exc.status, exc.message, request.url.path)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return error_response(exc.status_code, str(exc.detail), request.url.path)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        # e.g. "correctOption: Input should be 'A', 'B', 'C' or 'D'"
        message = "Invalid request"
        errors = exc.errors()
        if errors:
            field = ".".join(str(part) for part in errors[0].get("loc", ()) if part not in ("body", "query", "path"))
            text = str(errors[0].get("msg", message))
            message = f"{field}: {text}" if field else text
        return error_response(400, message, request.url.path)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return error_response(500, "Internal server error", request.url.path)
