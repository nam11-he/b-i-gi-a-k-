import os
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

# A key pair standing in for auth-service's (RS256)
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_KEY = PRIVATE_KEY.public_key()
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
KID = "test-key"

os.environ.update(
    AUTH_SERVICE_URL="http://auth.test",
    LEARNING_SERVICE_URL="http://learning.test",
)

from gateway import security  # noqa: E402
from gateway.config import get_settings  # noqa: E402
from gateway.main import create_app  # noqa: E402


@pytest.fixture
def client():
    get_settings.cache_clear()
    with TestClient(create_app()) as test_client:
        yield test_client


class FakePublicKeys:
    """auth-service's JWK Set in the tests: only the test key."""

    def find(self, kid):
        return PUBLIC_KEY if kid == KID else None


@pytest.fixture(autouse=True)
def test_keys(monkeypatch, request):
    monkeypatch.setattr(security, "public_keys", lambda: FakePublicKeys())
    # The session check calls auth-service; tests marked real_sessions check it with respx, the others skip it
    if "real_sessions" not in request.keywords:
        monkeypatch.setattr(security.sessions, "refusal", lambda settings, user_id, version, token: None)


@pytest.fixture
def auth_header():
    """Build an Authorization header like the ones auth-service issues (RS256, with the key id in the header)."""

    def build(sub: str = "2", role: str = "STUDENT", key=PRIVATE_KEY, expires_in: int = 3600, version: int = 0) -> dict:
        now = int(time.time())
        claims = {
            "iss": "nambede-auth",
            "sub": sub,
            "email": f"user{sub}@nambede.local",
            "name": f"User {sub}",
            "role": role,
            "ver": version,
            "iat": now,
            "exp": now + expires_in,
        }
        return {"Authorization": f"Bearer {jwt.encode(claims, key, algorithm='RS256', headers={'kid': KID})}"}

    return build
