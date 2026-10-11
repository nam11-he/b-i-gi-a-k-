"""X-Request-ID: one id per client request, passed from service to service and written on every log line.

The gateway gives each request an id here (or keeps a well-formed one sent by the client). Every service reads it from the
request, puts it in its own calls and events, and logs it, so `docker compose logs | grep <id>` shows the whole path.
"""

import contextvars
import logging
import re
import sys
import time
import uuid

from fastapi import FastAPI, Request

HEADER = "X-Request-ID"
_VALID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_current: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
#: Health checks run every few seconds: not worth a log line
_QUIET_PATHS = {"/api/health"}

log = logging.getLogger("gateway.access")


def current() -> str:
    return _current.get()


def header() -> dict[str, str]:
    """The header to send on a call to another service, so the id travels on."""
    value = _current.get()
    return {HEADER: value} if value != "-" else {}


def use(value: str | None) -> contextvars.Token[str]:
    """Makes `value` the current id (a new one when it is missing or malformed). Undo with `_current.reset(token)`."""
    return _current.set(value if value and _VALID.match(value) else uuid.uuid4().hex)


def reset(token: contextvars.Token[str]) -> None:
    _current.reset(token)


class _Filter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = _current.get()
        return True


def setup_logging() -> None:
    """INFO and above on stdout, each line with the request id."""
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_Filter())
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-5s [%(request_id)s] %(name)s: %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    # The called service logs each call itself, under the same request id
    logging.getLogger("httpx").setLevel(logging.WARNING)


def install(app: FastAPI) -> None:
    """Middleware: take the id from the request, answer it in the X-Request-ID header, log one line per request."""

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        token = use(request.headers.get(HEADER))
        started = time.perf_counter()
        try:
            response = await call_next(request)
            response.headers[HEADER] = current()
            if request.url.path not in _QUIET_PATHS:
                log.info("%s %s %s %d ms", request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
            return response
        finally:
            reset(token)
