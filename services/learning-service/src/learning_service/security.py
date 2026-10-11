"""Verifies the JWT issued by auth-service: RS256, with auth-service's public keys (jwks.py). Same logic as the gateway."""

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from learning_service.config import Settings, get_settings
from learning_service.errors import ApiError
from learning_service.jwks import KeysUnavailable, PublicKeys

bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="bearerAuth",  # the same name in every service, so Swagger reuses one token
    description="accessToken nhận được từ POST /api/auth/login",
)


@dataclass(frozen=True)
class CurrentUser:
    id: int
    email: str | None
    role: str
    #: The caller's raw token, forwarded when this service calls another one
    token: str

    @property
    def authorization(self) -> str:
        return f"Bearer {self.token}"

    @property
    def is_admin(self) -> bool:
        return self.role == "ADMIN"


@lru_cache
def public_keys() -> PublicKeys:
    return PublicKeys(get_settings().jwks_url)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    if credentials is None:
        raise ApiError(401, "Authentication required")
    try:
        key = public_keys().find(jwt.get_unverified_header(credentials.credentials).get("kid"))
    except KeysUnavailable:
        # 502, not 401: the token may be fine, and a 401 would sign the user out of the web and the app
        raise ApiError(502, "auth-service is unavailable") from None
    except jwt.PyJWTError:
        raise ApiError(401, "Invalid or expired token") from None
    if key is None:
        raise ApiError(401, "Invalid or expired token")
    try:
        claims = jwt.decode(
            credentials.credentials,
            key,
            algorithms=["RS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub", "iss"]},
        )
        user = CurrentUser(id=int(claims["sub"]), email=claims.get("email"), role=claims["role"], token=credentials.credentials)
    except (jwt.PyJWTError, KeyError, ValueError):
        raise ApiError(401, "Invalid or expired token") from None
    return user


def require_role(*roles: str):
    """Dependency factory: allow only callers whose JWT role is one of `roles`."""

    def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if user.role not in roles:
            raise ApiError(403, "You do not have permission to perform this action")
        return user

    return dependency


SignedIn = Annotated[CurrentUser, Depends(get_current_user)]
#: Lecturers and admins: the question bank shows correct answers, so students are kept out
Staff = Annotated[CurrentUser, Depends(require_role("TEACHER", "ADMIN"))]
#: Practice, vocabulary notebook, streak: only students have them
Student = Annotated[CurrentUser, Depends(require_role("STUDENT"))]
