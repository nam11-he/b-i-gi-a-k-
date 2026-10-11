import os
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# A key pair standing in for auth-service's (RS256)
PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_KEY = PRIVATE_KEY.public_key()
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
KID = "test-key"

os.environ.update(
    # Nothing listens on port 1: lets the tests check the health endpoint's DOWN answer without a database
    DATABASE_URL="postgresql+psycopg://nambede:nambede@127.0.0.1:1/learning_db?connect_timeout=2",
)

from learning_service import auth_client, security  # noqa: E402
from learning_service.db import Base, get_db  # noqa: E402
from learning_service.main import app  # noqa: E402

#: Names auth-service would return for these user ids
NAMES = {1: "Administrator", 3: "Trần Thị B", 4: "Lê Văn C"}


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


class FakePublicKeys:
    """auth-service's JWK Set in the tests: only the test key."""

    def find(self, kid):
        return PUBLIC_KEY if kid == KID else None


@pytest.fixture(autouse=True)
def test_keys(monkeypatch):
    monkeypatch.setattr(security, "public_keys", lambda: FakePublicKeys())


@pytest.fixture
def auth_header():
    """An Authorization header like the ones auth-service issues (RS256, with the key id in the header)."""

    def build(sub: str = "2", role: str = "STUDENT", key=PRIVATE_KEY) -> dict:
        now = int(time.time())
        claims = {"iss": "nambede-auth", "sub": sub, "role": role, "ver": 0, "iat": now, "exp": now + 3600}
        return {"Authorization": f"Bearer {jwt.encode(claims, key, algorithm='RS256', headers={'kid': KID})}"}

    return build


@pytest.fixture
def session_factory():
    """Sessions on an empty in-memory SQLite database (one connection, so every session sees the same data)."""
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def bank(monkeypatch, session_factory):
    """The app on an empty in-memory SQLite database, with auth-service names faked."""

    def override_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    monkeypatch.setattr(auth_client, "lookup_names", lambda ids, authorization: {i: NAMES[i] for i in ids if i in NAMES})
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
