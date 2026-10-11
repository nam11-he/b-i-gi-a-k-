"""BFF aggregation: the client makes one call, the gateway asks the services in parallel."""

import asyncio
from typing import Annotated, Any

import httpx
from fastapi import APIRouter, Depends, Request, Response

from gateway import requestid
from gateway.config import Settings, get_settings
from gateway.errors import GatewayError
from gateway.security import CurrentUser, require_role

router = APIRouter(tags=["BFF"])


async def learning_progress(client: httpx.AsyncClient, settings: Settings, headers: dict[str, str]) -> dict[str, int | None]:
    """Current streak, total activity points and this week's rank from learning-service (None when it cannot answer)."""
    result: dict[str, int | None] = {"streak": None, "points": None, "weeklyRank": None}
    try:
        streak, ranking = await asyncio.gather(
            client.get(f"{settings.learning_service_url}/streak", headers=headers),
            client.get(f"{settings.learning_service_url}/ranking/weekly", params={"limit": 0}, headers=headers),
        )
        if streak.status_code == 200:
            result["streak"] = streak.json()["currentStreak"]
        me = ranking.json().get("me") if ranking.status_code == 200 else None
        if me:
            result["points"] = me["totalPoints"]
            result["weeklyRank"] = me["rank"]
    except (httpx.HTTPError, ValueError, KeyError, AttributeError):
        pass
    return result


@router.get(
    "/api/dashboard/student",
    response_model=None,
    summary="Tổng quan của sinh viên: một lần gọi, gateway gộp dữ liệu từ Auth Service và Learning Service (STUDENT)",
)
async def student_dashboard(
    request: Request,
    user: Annotated[CurrentUser, Depends(require_role("STUDENT"))],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any] | Response:
    """One call for the client, two services behind it: profile (auth), streak, points and weekly rank (learning).
    If learning-service cannot answer, its numbers are null and the profile still shows."""
    client: httpx.AsyncClient = request.app.state.http
    headers = {"authorization": request.headers["authorization"], **requestid.header()}
    try:
        me, progress = await asyncio.gather(
            client.get(f"{settings.auth_service_url}/users/me", headers=headers),
            learning_progress(client, settings, headers),
        )
    except httpx.HTTPError:
        raise GatewayError(502, "auth-service is unavailable") from None
    if me.status_code != 200:
        return Response(me.content, status_code=me.status_code, media_type=me.headers.get("content-type"))

    profile = me.json()
    return {
        "student": {
            "id": profile["id"],
            "name": profile["fullName"],
            "email": profile["email"],
            "role": profile["role"],
            "accountType": profile["accountType"],
        },
        "streak": progress["streak"],
        "points": progress["points"],
        "weeklyRank": progress["weeklyRank"],
    }
