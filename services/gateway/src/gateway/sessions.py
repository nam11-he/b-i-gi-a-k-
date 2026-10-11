"""Is a token's session still open? Only auth-service knows: since the token was issued, an admin may have locked the
account or changed its role (token_version). The gateway asks GET /auth/session and keeps a "yes" for a few seconds
per user and token version, so auth-service gets about one call per active user every few seconds, not one per request.

auth-service unreachable: the request goes through on its valid signature (and a warning is logged). Locking then
takes effect when auth-service is back; refusing every request instead would stop the whole system with one service.
"""

import logging
import threading
import time

import httpx

from gateway import requestid
from gateway.config import Settings

log = logging.getLogger(__name__)

#: Above this many entries, the expired ones are dropped
_PRUNE_ABOVE = 10_000


class Sessions:
    def __init__(self) -> None:
        self._open_until: dict[tuple[str, int], float] = {}
        self._lock = threading.Lock()

    def refusal(self, settings: Settings, user_id: str, version: int, token: str) -> str | None:
        """None when the session is open, otherwise why it is not (auth-service's message)."""
        key = (user_id, version)
        now = time.monotonic()
        with self._lock:
            if self._open_until.get(key, 0.0) > now:
                return None
        try:
            response = httpx.get(
                f"{settings.auth_service_url}/auth/session",
                headers={"authorization": f"Bearer {token}", **requestid.header()},
                timeout=5.0,
            )
        except httpx.HTTPError as exc:
            log.warning("auth-service did not answer the session check (%s), letting the request through", exc.__class__.__name__)
            return None
        if response.status_code == 204:
            with self._lock:
                if len(self._open_until) > _PRUNE_ABOVE:
                    self._open_until = {k: until for k, until in self._open_until.items() if until > now}
                self._open_until[key] = now + settings.session_check_seconds
            return None
        if response.status_code == 401:
            try:
                return str(response.json()["message"])
            except (ValueError, KeyError, TypeError):
                return "Session ended, sign in again"
        log.warning("auth-service answered %s to the session check, letting the request through", response.status_code)
        return None


sessions = Sessions()
