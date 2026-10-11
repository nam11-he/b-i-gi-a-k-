"""JWT check at the gateway. The token is issued by auth-service (RS256) and checked with its public keys (jwks.py);
the services verify it again. Only the gateway also asks auth-service whether the session is still open (sessions.py):
a locked account or a changed role ends the old tokens within a few seconds, not when they expire."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from gateway.config import Settings, get_settings
from gateway.errors import GatewayError
from gateway.jwks import KeysUnavailable, PublicKeys
from gateway.sessions import sessions

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="bearerAuth",  # the same name in every service, so Swagger reuses one token
    description="accessToken nhận được từ POST /api/auth/login",
)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    name: str | None
    role: str


@lru_cache
def public_keys() -> PublicKeys:
    return PublicKeys(get_settings().jwks_url)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    if credentials is None:
        raise GatewayError(401, "Authentication required")
    token = credentials.credentials
    try:
        key = public_keys().find(jwt.get_unverified_header(token).get("kid"))
    except KeysUnavailable:
        # 502, not 401: the token may be fine, and a 401 would sign the user out of the web and the app
        raise GatewayError(502, "auth-service is unavailable") from None
    except jwt.PyJWTError:
        raise GatewayError(401, "Invalid or expired token") from None
    if key is None:
        raise GatewayError(401, "Invalid or expired token")
    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub", "iss"]},
        )
    except jwt.PyJWTError:
        raise GatewayError(401, "Invalid or expired token") from None
    if not claims.get("role"):
        raise GatewayError(401, "Invalid or expired token")
    refusal = sessions.refusal(settings, str(claims["sub"]), int(claims.get("ver", 0)), token)
    if refusal:
        raise GatewayError(401, refusal)
    return CurrentUser(id=claims["sub"], email=claims.get("email"), name=claims.get("name"), role=claims["role"])


def require_role(*roles: str):
    """Dependency factory: allow only callers whose JWT role is one of `roles`."""

    def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise GatewayError(403, "You do not have permission to perform this action")
        return user

    return dependency
