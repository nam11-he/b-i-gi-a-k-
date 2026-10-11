import httpx
import pytest

from learning_service import auth_client

ADMIN = ("1", "ADMIN")
STUDENT = ("2", "STUDENT")
TEACHER = ("3", "TEACHER")
OTHER_TEACHER = ("4", "TEACHER")


def question_body(topic_id: int, **changes) -> dict:
    body = {
        "topicId": topic_id,
        "content": "She ___ to school every day.",
        "optionA": "go",
        "optionB": "goes",
        "optionC": "gone",
        "optionD": "going",
        "correctOption": "B",
        "explanation": "Chủ ngữ số ít ở thì hiện tại đơn: động từ thêm -es.",
    }
    body.update(changes)
    return body


@pytest.fixture
def as_user(auth_header):
    return lambda who: auth_header(*who)


@pytest.fixture
def topic(bank, as_user):
    response = bank.post("/topics", json={"name": "Thì hiện tại đơn", "description": "Present simple"}, headers=as_user(TEACHER))
    assert response.status_code == 201
    return response.json()


def test_students_read_topics_but_cannot_create_them(bank, as_user):
    assert bank.get("/topics", headers=as_user(STUDENT)).json() == []
    assert bank.post("/topics", json={"name": "Từ vựng"}, headers=as_user(STUDENT)).status_code == 403


def test_lecturer_creates_a_topic_with_a_unique_name(bank, as_user, topic):
    assert topic["createdByName"] == "Trần Thị B"
    assert topic["questionCount"] == 0
    duplicate = bank.post("/topics", json={"name": "THÌ HIỆN TẠI ĐƠN"}, headers=as_user(OTHER_TEACHER))
    assert duplicate.status_code == 409


def test_only_the_author_or_an_admin_changes_a_topic(bank, as_user, topic):
    url = f"/topics/{topic['id']}"
    assert bank.put(url, json={"name": "Đổi tên"}, headers=as_user(OTHER_TEACHER)).status_code == 403
    renamed = bank.put(url, json={"name": "Present simple"}, headers=as_user(ADMIN))
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Present simple"


def test_question_lifecycle_in_the_shared_bank(bank, as_user, topic):
    created = bank.post("/questions", json=question_body(topic["id"]), headers=as_user(TEACHER))
    assert created.status_code == 201
    question = created.json()
    assert question["correctOption"] == "B"
    assert question["topicName"] == "Thì hiện tại đơn"
    assert question["createdByName"] == "Trần Thị B"
    url = f"/questions/{question['id']}"

    # Shared bank: another lecturer sees it but cannot change it
    assert [q["id"] for q in bank.get("/questions", headers=as_user(OTHER_TEACHER)).json()] == [question["id"]]
    assert bank.put(url, json=question_body(topic["id"], correctOption="A"), headers=as_user(OTHER_TEACHER)).status_code == 403
    assert bank.delete(url, headers=as_user(OTHER_TEACHER)).status_code == 403

    edited = bank.put(url, json=question_body(topic["id"], content="He ___ football on Sundays."), headers=as_user(TEACHER))
    assert edited.status_code == 200
    assert edited.json()["content"] == "He ___ football on Sundays."

    # A topic that still has questions cannot be deleted
    assert bank.get("/topics", headers=as_user(TEACHER)).json()[0]["questionCount"] == 1
    assert bank.delete(f"/topics/{topic['id']}", headers=as_user(TEACHER)).status_code == 409

    # An admin can delete anybody's question; then the topic can go
    assert bank.delete(url, headers=as_user(ADMIN)).status_code == 204
    assert bank.get(url, headers=as_user(TEACHER)).status_code == 404
    assert bank.delete(f"/topics/{topic['id']}", headers=as_user(TEACHER)).status_code == 204


def test_students_cannot_open_the_question_bank(bank, as_user, topic):
    bank.post("/questions", json=question_body(topic["id"]), headers=as_user(TEACHER))
    assert bank.get("/questions", headers=as_user(STUDENT)).status_code == 403
    assert bank.get("/questions/1", headers=as_user(STUDENT)).status_code == 403


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"correctOption": "E"}, "correctOption"),
        ({"optionD": None}, "optionD"),
        ({"content": "   "}, "content"),
    ],
)
def test_invalid_questions_are_rejected(bank, as_user, topic, changes, field):
    response = bank.post("/questions", json=question_body(topic["id"], **changes), headers=as_user(TEACHER))
    assert response.status_code == 400
    assert response.json()["message"].startswith(field)


def test_question_needs_an_existing_topic(bank, as_user):
    response = bank.post("/questions", json=question_body(999), headers=as_user(TEACHER))
    assert response.status_code == 400
    assert response.json()["message"] == "Topic 999 does not exist"


def test_filters_by_topic_text_and_author(bank, as_user, topic):
    other_topic = bank.post("/topics", json={"name": "Thì quá khứ đơn"}, headers=as_user(OTHER_TEACHER)).json()
    mine = bank.post("/questions", json=question_body(topic["id"]), headers=as_user(TEACHER)).json()
    theirs = bank.post(
        "/questions", json=question_body(other_topic["id"], content="They ___ (visit) Hue last year."), headers=as_user(OTHER_TEACHER)
    ).json()
    ids = lambda response: [q["id"] for q in response.json()]  # noqa: E731

    assert ids(bank.get(f"/questions?topicId={topic['id']}", headers=as_user(TEACHER))) == [mine["id"]]
    assert ids(bank.get("/questions?q=last year", headers=as_user(TEACHER))) == [theirs["id"]]
    assert ids(bank.get("/questions?mine=true", headers=as_user(TEACHER))) == [mine["id"]]
    assert ids(bank.get("/questions", headers=as_user(ADMIN))) == [theirs["id"], mine["id"]]


def test_names_are_missing_when_auth_service_is_down(bank, as_user, monkeypatch):
    monkeypatch.setattr(auth_client, "lookup_names", lambda ids, authorization: {})
    created = bank.post("/topics", json={"name": "Ngữ pháp"}, headers=as_user(TEACHER))
    assert created.status_code == 201
    assert created.json()["createdByName"] is None


def test_lookup_names_calls_auth_service_and_survives_errors(monkeypatch):
    seen = {}

    def fake_get(url, params, headers, timeout):
        seen.update(url=url, params=params, headers=headers)
        return httpx.Response(200, json=[{"id": 3, "fullName": "Trần Thị B"}], request=httpx.Request("GET", url))

    monkeypatch.setattr(auth_client.httpx, "get", fake_get)
    assert auth_client.lookup_names([3, 3], "Bearer t") == {3: "Trần Thị B"}
    assert seen["url"].endswith("/users/lookup")
    assert seen["params"] == {"ids": "3"}
    assert seen["headers"] == {"authorization": "Bearer t"}

    def broken_get(*args, **kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(auth_client.httpx, "get", broken_get)
    assert auth_client.lookup_names([3], "Bearer t") == {}
    assert auth_client.lookup_names([], "Bearer t") == {}
