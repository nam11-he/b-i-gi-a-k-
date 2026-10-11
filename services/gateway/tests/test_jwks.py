"""jwks.py: auth-service's public keys, read once and kept."""

import httpx
import jwt
import pytest
import respx

from conftest import KID, PUBLIC_KEY
from gateway.jwks import KeysUnavailable, PublicKeys

URL = "http://auth.test/.well-known/jwks.json"


def jwk_set() -> dict:
    jwk = jwt.algorithms.RSAAlgorithm.to_jwk(PUBLIC_KEY, as_dict=True)
    return {"keys": [{**jwk, "kid": KID, "use": "sig", "alg": "RS256"}]}


@respx.mock
def test_the_keys_are_read_once_and_kept():
    route = respx.get(URL).mock(return_value=httpx.Response(200, json=jwk_set()))
    keys = PublicKeys(URL)

    assert keys.find(KID).public_numbers() == PUBLIC_KEY.public_numbers()
    assert keys.find(KID) is not None
    # An unknown key id right after: not asked again before MIN_REFRESH_SECONDS
    assert keys.find("someone-elses-key") is None
    assert route.call_count == 1


@respx.mock
def test_auth_service_down_with_no_known_key_is_unavailable():
    respx.get(URL).mock(side_effect=httpx.ConnectError("connection refused"))

    with pytest.raises(KeysUnavailable):
        PublicKeys(URL).find(KID)
