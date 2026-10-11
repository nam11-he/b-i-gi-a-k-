"""REST client for auth-service. Services never read another service's database: names come from its API."""

import logging
from collections.abc import Iterable

import httpx

from learning_service import requestid
from learning_service.config import get_settings

log = logging.getLogger(__name__)


def lookup_names(user_ids: Iterable[int], authorization: str) -> dict[int, str]:
    """Full names by user id (GET /users/lookup, with the caller's token).

    If auth-service cannot answer, returns {}: the caller still gets its data, only without names.
    """
    ids = sorted(set(user_ids))
    if not ids:
        return {}
    try:
        response = httpx.get(
            f"{get_settings().auth_service_url}/users/lookup",
            params={"ids": ",".join(str(user_id) for user_id in ids)},
            headers={"authorization": authorization, **requestid.header()},
            timeout=5.0,
        )
        response.raise_for_status()
        return {user["id"]: user["fullName"] for user in response.json()}
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        log.warning("auth-service did not answer the user lookup, continuing without names: %s", exc)
        return {}


def account_type(user_id: int, authorization: str) -> str | None:
    """FREE or VIP from GET /users/{id}/account-type, or None when auth-service cannot answer."""
    try:
        response = httpx.get(
            f"{get_settings().auth_service_url}/users/{user_id}/account-type",
            headers={"authorization": authorization, **requestid.header()},
            timeout=5.0,
        )
        response.raise_for_status()
        value = response.json()["accountType"]
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        log.warning("auth-service did not answer the account type of user %s: %s", user_id, exc)
        return None
    return value if value in ("FREE", "VIP") else None
