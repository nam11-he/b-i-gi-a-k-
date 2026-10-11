import httpx
from fastapi import Request, Response

from gateway import requestid
from gateway.errors import GatewayError

# Only these request headers are passed to the services (Host, Connection, ... stay at the gateway).
FORWARDED_HEADERS = {"authorization", "content-type", "accept", "accept-language"}

# Only these response headers come back to the client, besides Content-Type. Content-Length and Transfer-Encoding
# are set again by the gateway; Content-Disposition keeps the name of a downloaded file (the Excel template),
# Retry-After tells a client blocked after too many failed sign-ins when to try again.
RETURNED_HEADERS = {"content-disposition", "cache-control", "location", "retry-after"}


async def forward(request: Request, service: str, base_url: str, path: str) -> Response:
    """Send the incoming request to `base_url + path` and return the service's answer unchanged.

    If the service cannot be reached the client gets a 502 from the gateway.
    """
    client: httpx.AsyncClient = request.app.state.http
    url = f"{base_url}{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"
    headers = {name: value for name, value in request.headers.items() if name in FORWARDED_HEADERS}
    headers.update(requestid.header())  # the services log the same id as the gateway
    try:
        upstream = await client.request(request.method, url, headers=headers, content=await request.body())
    except httpx.HTTPError:
        raise GatewayError(502, f"{service} is unavailable") from None
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers={name: value for name, value in upstream.headers.items() if name in RETURNED_HEADERS},
        media_type=upstream.headers.get("content-type"),
    )
