from conftest import OTHER_KEY


def test_ping_without_token_returns_401(client):
    response = client.get("/topics/ping")

    assert response.status_code == 401
    assert response.json()["message"] == "Authentication required"


def test_ping_with_token_signed_by_another_key_returns_401(client, auth_header):
    headers = auth_header(key=OTHER_KEY)

    assert client.get("/topics/ping", headers=headers).status_code == 401


def test_ping_with_token_returns_the_caller(client, auth_header):
    response = client.get("/topics/ping", headers=auth_header())

    assert response.status_code == 200
    assert response.json() == {"service": "learning-service", "userId": 2, "role": "STUDENT"}


def test_health_reports_down_when_the_database_is_unreachable(client):
    response = client.get("/health")

    assert response.status_code == 503
    assert response.json() == {"status": "DOWN", "db": "DOWN"}


def test_every_answer_carries_the_request_id(client):
    response = client.get("/health", headers={"X-Request-ID": "gw-123"})
    assert response.headers["X-Request-ID"] == "gw-123"

