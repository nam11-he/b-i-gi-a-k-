"""The public keys of auth-service, read from its JWK Set (GET /.well-known/jwks.json) and kept in memory.

Checking a token then needs no call at all. A key id not seen before (auth-service made a new key) reads the set
again, at most every MIN_REFRESH_SECONDS, so made-up key ids cannot flood auth-service. This service can check a
token but never make one: it holds no signing key.
"""

import logging
import threading
import time
from typing import Any

import httpx
import jwt

log = logging.getLogger(__name__)

MIN_REFRESH_SECONDS = 10.0


class KeysUnavailable(Exception):
    """auth-service cannot be reached and no key is known yet: no token can be checked (502, not 401)."""


class PublicKeys:
    def __init__(self, url: str) -> None:
        self.url = url
        self._keys: dict[str, Any] = {}
        self._fetched_at: float | None = None
        self._lock = threading.Lock()

    def _may_refresh(self) -> bool:
        return self._fetched_at is None or time.monotonic() - self._fetched_at > MIN_REFRESH_SECONDS

    def find(self, kid: str | None) -> Any | None:
        """The key with this id, or None when auth-service has no such key. Raises KeysUnavailable."""
        key = self._keys.get(kid) if kid else None
        if key is None and kid and self._may_refresh():
            self._refresh()
            key = self._keys.get(kid)
        return key

    def _refresh(self) -> None:
        with self._lock:
            if not self._may_refresh():
                return  # another request just did it
            self._fetched_at = time.monotonic()
            try:
                response = httpx.get(self.url, timeout=5.0)
                response.raise_for_status()
                keys = {jwk.key_id: jwk.key for jwk in jwt.PyJWKSet.from_dict(response.json()).keys if jwk.key_id}
            except (httpx.HTTPError, ValueError, jwt.PyJWKSetError) as exc:
                if not self._keys:
                    self._fetched_at = None  # nothing to work with: try again on the next request
                    raise KeysUnavailable("auth-service is unavailable") from exc
                log.warning("Could not refresh the public keys from %s, keeping the %d known: %s", self.url, len(self._keys), exc)
                return
            self._keys = keys
            log.info("Read %d public key(s) from %s", len(keys), self.url)
