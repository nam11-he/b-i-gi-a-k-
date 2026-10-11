"""Phase 5: practice rounds, vocabulary notebook, streak, activity points and the weekly ranking."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from learning_service import auth_client, clock

STUDENT = ("2", "STUDENT")
VIP_STUDENT = ("5", "STUDENT")
OTHER_STUDENT = ("6", "STUDENT")
TEACHER = ("3", "TEACHER")

#: What auth-service would answer for GET /users/{id}/account-type (user 6 is unknown: FREE by default)
ACCOUNT_TYPES = {2: "FREE", 5: "VIP"}
STUDENT_NAMES = {2: "Nguyễn Văn A", 5: "Phạm Thị D", 6: "Hoàng Văn E"}


class FakeClock:
    """Starts on Thursday 1 October 2026 at 10:00 in Vietnam (03:00 UTC)."""

    def __init__(self) -> None:
        self.value = datetime(2026, 10, 1, 3, 0, tzinfo=UTC)

    def advance(self, **delta: float) -> None:
        self.value += timedelta(**delta)


@pytest.fixture
def now(monkeypatch):
    fake = FakeClock()
    monkeypatch.setattr(clock, "now", lambda: fake.value)
    return fake


@pytest.fixture
def client(bank, monkeypatch, now):
    monkeypatch.setattr(auth_client, "account_type", lambda user_id, authorization: ACCOUNT_TYPES.get(user_id))
    monkeypatch.setattr(auth_client, "lookup_names", lambda ids, authorization: {i: STUDENT_NAMES[i] for i in ids if i in STUDENT_NAMES})
    return bank


@pytest.fixture
def h(auth_header):
    return lambda who: auth_header(*who)


@pytest.fixture
def topics(client, h):
    """15 present-simple questions (answer B) and 10 past-simple questions (answer C)."""

    def add_topic(name: str) -> int:
        return client.post("/topics", json={"name": name}, headers=h(TEACHER)).json()["id"]

    def add_question(topic_id: int, content: str, correct: str) -> None:
        body = {
            "topicId": topic_id,
            "content": content,
            "optionA": "a",
            "optionB": "b",
            "optionC": "c",
            "optionD": "d",
            "correctOption": correct,
            "explanation": f"Đáp án {correct}.",
        }
        assert client.post("/questions", json=body, headers=h(TEACHER)).status_code == 201

    present, past = add_topic("Thì hiện tại đơn"), add_topic("Thì quá khứ đơn")
    for index in range(15):
        add_question(present, f"Present {index}", "B")
    for index in range(10):
        add_question(past, f"Past {index}", "C")
    return {"present": present, "past": past}


def start(client, h, who, **body):
    return client.post("/practice/start", json={"mode": "RANDOM", "questionCount": 5, **body}, headers=h(who))


def submit(client, h, who, session_id, answers=None):
    return client.post("/practice/submit", json={"sessionId": session_id, "answers": answers or []}, headers=h(who))


def practise(client, h, who, correct=0, topic_id=None):
    """A finished round of one question per point wanted; `correct` of them answered right (past simple: C)."""
    count = max(1, correct)
    body = {"mode": "TOPIC", "topicId": topic_id, "questionCount": count} if topic_id else {"questionCount": count}
    round_ = start(client, h, who, **body).json()
    answers = [{"questionId": q["id"], "chosenOption": "C"} for q in round_["questions"][:correct]]
    return submit(client, h, who, round_["sessionId"], answers).json()


# ------------------------------------------------------------------------------------------------ practice


def test_free_students_take_at_most_twenty_questions_per_round(client, h, topics):
    assert client.get("/practice/limit", headers=h(STUDENT)).json() == {"accountType": "FREE", "maxQuestions": 20, "accountTypeChecked": True}
    too_many = start(client, h, STUDENT, questionCount=21)
    assert too_many.status_code == 403
    assert too_many.json()["message"] == "FREE accounts can practise at most 20 questions per round"

    round_ = start(client, h, STUDENT, questionCount=20)
    assert round_.status_code == 201
    body = round_.json()
    assert (body["status"], body["questionCount"], body["mode"]) == ("IN_PROGRESS", 20, "RANDOM")
    assert len({question["id"] for question in body["questions"]}) == 20
    assert [question["position"] for question in body["questions"]] == list(range(1, 21))
    # Answers stay hidden until the round is submitted
    assert all(q["correctOption"] is None and q["explanation"] is None and q["correct"] is None for q in body["questions"])


def test_vip_students_take_up_to_fifty_and_free_applies_when_auth_is_down(client, h, topics, monkeypatch):
    assert client.get("/practice/limit", headers=h(VIP_STUDENT)).json()["maxQuestions"] == 50
    vip_round = start(client, h, VIP_STUDENT, questionCount=50)
    assert vip_round.status_code == 201
    assert vip_round.json()["questionCount"] == 25  # the whole bank

    monkeypatch.setattr(auth_client, "account_type", lambda user_id, authorization: None)
    assert client.get("/practice/limit", headers=h(VIP_STUDENT)).json() == {
        "accountType": "FREE",
        "maxQuestions": 20,
        "accountTypeChecked": False,
    }
    assert start(client, h, VIP_STUDENT, questionCount=50).status_code == 403


def test_topic_rounds_and_their_errors(client, h, topics):
    round_ = start(client, h, STUDENT, mode="TOPIC", topicId=topics["past"], questionCount=20).json()
    assert round_["questionCount"] == 10
    assert round_["topicName"] == "Thì quá khứ đơn"
    assert all(question["content"].startswith("Past") for question in round_["questions"])

    assert start(client, h, STUDENT, mode="TOPIC").status_code == 400  # topicId missing
    assert start(client, h, STUDENT, mode="TOPIC", topicId=999).status_code == 404
    empty = client.post("/topics", json={"name": "Từ vựng"}, headers=h(TEACHER)).json()
    assert start(client, h, STUDENT, mode="TOPIC", topicId=empty["id"]).status_code == 409
    assert start(client, h, STUDENT, questionCount=0).status_code == 400
    assert start(client, h, TEACHER).status_code == 403


def test_submit_grades_from_the_copy_adds_points_and_starts_the_streak(client, h, topics):
    round_ = start(client, h, STUDENT, mode="TOPIC", topicId=topics["past"], questionCount=3).json()
    first, second, third = (question["id"] for question in round_["questions"])

    # The lecturer changes the first question's correct answer after the round started
    bank_question = client.get(f"/questions/{first}", headers=h(TEACHER)).json()
    bank_question["correctOption"] = "A"
    assert client.put(f"/questions/{first}", json=bank_question, headers=h(TEACHER)).status_code == 200

    result = submit(client, h, STUDENT, round_["sessionId"], [{"questionId": first, "chosenOption": "C"}, {"questionId": second, "chosenOption": "A"}])
    assert result.status_code == 200
    body = result.json()
    assert (body["status"], body["correctCount"], body["score"], body["pointsEarned"]) == ("SUBMITTED", 1, 3.33, 11)
    assert body["totalPoints"] == 11
    assert body["streak"] == {"currentStreak": 1, "longestStreak": 1, "lastActiveDate": "2026-10-01", "activeToday": True}
    graded = {question["id"]: question for question in body["questions"]}
    assert (graded[first]["correctOption"], graded[first]["correct"]) == ("C", True)  # the copy, not the edited bank
    assert graded[first]["explanation"] == "Đáp án C."
    assert (graded[second]["chosenOption"], graded[second]["correct"]) == ("A", False)
    assert (graded[third]["chosenOption"], graded[third]["correct"]) == (None, False)

    assert submit(client, h, STUDENT, round_["sessionId"]).status_code == 409
    assert submit(client, h, VIP_STUDENT, round_["sessionId"]).status_code == 403
    other = start(client, h, STUDENT).json()
    assert submit(client, h, STUDENT, other["sessionId"], [{"questionId": 9999, "chosenOption": "A"}]).status_code == 400

    history = client.get("/practice/sessions", headers=h(STUDENT)).json()
    assert [(item["sessionId"], item["status"]) for item in history] == [(other["sessionId"], "IN_PROGRESS"), (round_["sessionId"], "SUBMITTED")]
    assert history[1]["score"] == 3.33
    saved = client.get(f"/practice/sessions/{round_['sessionId']}", headers=h(STUDENT)).json()
    assert saved["questions"][0]["correctOption"] == "C"
    assert client.get(f"/practice/sessions/{round_['sessionId']}", headers=h(VIP_STUDENT)).status_code == 403


# ------------------------------------------------------------------------------------------- streak, points


def test_streak_counts_local_days_in_a_row_and_restarts_after_a_gap(client, h, topics, now):
    assert client.get("/streak", headers=h(STUDENT)).json() == {"currentStreak": 0, "longestStreak": 0, "lastActiveDate": None, "activeToday": False}

    practise(client, h, STUDENT)  # Thursday 10:00
    practise(client, h, STUDENT)  # same day: still 1
    now.advance(hours=15)  # 18:00 UTC is already Friday 01:00 in Vietnam
    practise(client, h, STUDENT)
    now.advance(days=1)  # Saturday: saving a new word also counts
    assert client.post("/vocabularies", json={"word": "streak", "meaning": "chuỗi"}, headers=h(STUDENT)).status_code == 201
    assert client.get("/streak", headers=h(STUDENT)).json() == {"currentStreak": 3, "longestStreak": 3, "lastActiveDate": "2026-10-03", "activeToday": True}

    now.advance(days=1)  # Sunday, nothing done yet: the streak is still alive
    assert client.get("/streak", headers=h(STUDENT)).json()["currentStreak"] == 3
    now.advance(days=1)  # Monday: Sunday was missed
    assert client.get("/streak", headers=h(STUDENT)).json() == {"currentStreak": 0, "longestStreak": 3, "lastActiveDate": "2026-10-03", "activeToday": False}
    practise(client, h, STUDENT)
    assert client.get("/streak", headers=h(STUDENT)).json()["currentStreak"] == 1


def test_weekly_ranking_counts_this_weeks_points_with_shared_ranks(client, h, topics, now):
    now.value = datetime(2026, 9, 27, 3, 0, tzinfo=UTC)  # last Sunday: does not count this week
    practise(client, h, VIP_STUDENT)
    now.value = datetime(2026, 10, 1, 3, 0, tzinfo=UTC)
    practise(client, h, STUDENT)  # 10 points
    practise(client, h, VIP_STUDENT)  # 10 points
    practise(client, h, OTHER_STUDENT, correct=2, topic_id=topics["past"])  # 10 + 2

    ranking = client.get("/ranking/weekly", headers=h(STUDENT)).json()
    assert (ranking["weekStart"], ranking["weekEnd"]) == ("2026-09-28", "2026-10-04")
    assert [(entry["rank"], entry["fullName"], entry["points"]) for entry in ranking["entries"]] == [
        (1, "Hoàng Văn E", 12),
        (2, "Nguyễn Văn A", 10),
        (2, "Phạm Thị D", 10),
    ]
    assert ranking["me"]["rank"] == 2 and ranking["me"]["weekPoints"] == 10 and ranking["me"]["totalPoints"] == 10
    assert ranking["me"]["recent"][0] | {"createdAt": None} == {"points": 10, "reason": "PRACTICE", "detail": None, "createdAt": None}

    vip = client.get("/ranking/weekly", headers=h(VIP_STUDENT)).json()["me"]
    assert (vip["rank"], vip["weekPoints"], vip["totalPoints"]) == (2, 10, 20)

    teacher_view = client.get("/ranking/weekly?limit=1", headers=h(TEACHER)).json()
    assert teacher_view["me"] is None
    assert [entry["fullName"] for entry in teacher_view["entries"]] == ["Hoàng Văn E"]
    summary = client.get("/ranking/weekly?limit=0", headers=h(STUDENT)).json()
    assert summary["entries"] == [] and summary["me"]["rank"] == 2


# --------------------------------------------------------------------------------------------- vocabulary


def test_vocabulary_notebook_is_private_and_has_no_duplicates(client, h):
    word = client.post("/vocabularies", json={"word": "persevere", "meaning": "kiên trì", "example": "Persevere and you will win."}, headers=h(STUDENT))
    assert word.status_code == 201
    saved = word.json()
    assert (saved["word"], saved["meaning"]) == ("persevere", "kiên trì")
    url = f"/vocabularies/{saved['id']}"

    assert client.post("/vocabularies", json={"word": "PERSEVERE", "meaning": "bền bỉ"}, headers=h(STUDENT)).status_code == 409
    # Another student neither sees nor changes it, but can save the same word
    assert client.get("/vocabularies", headers=h(VIP_STUDENT)).json() == []
    assert client.put(url, json={"word": "x", "meaning": "y"}, headers=h(VIP_STUDENT)).status_code == 404
    assert client.delete(url, headers=h(VIP_STUDENT)).status_code == 404
    assert client.post("/vocabularies", json={"word": "persevere", "meaning": "kiên trì"}, headers=h(VIP_STUDENT)).status_code == 201

    assert client.post("/vocabularies", json={"word": "diligent", "meaning": "chăm chỉ"}, headers=h(STUDENT)).status_code == 201
    assert [item["word"] for item in client.get("/vocabularies?q=kiên", headers=h(STUDENT)).json()] == ["persevere"]
    assert [item["word"] for item in client.get("/vocabularies", headers=h(STUDENT)).json()] == ["diligent", "persevere"]
    edited = client.put(url, json={"word": "persevere", "meaning": "kiên trì, bền bỉ"}, headers=h(STUDENT))
    assert edited.status_code == 200 and edited.json()["meaning"] == "kiên trì, bền bỉ"
    assert client.put(url, json={"word": "Diligent", "meaning": "chăm chỉ"}, headers=h(STUDENT)).status_code == 409

    assert client.delete(url, headers=h(STUDENT)).status_code == 204
    assert [item["word"] for item in client.get("/vocabularies", headers=h(STUDENT)).json()] == ["diligent"]
    assert client.post("/vocabularies", json={"word": " ", "meaning": "trống"}, headers=h(STUDENT)).status_code == 400
    assert client.get("/vocabularies", headers=h(TEACHER)).status_code == 403


# ------------------------------------------------------------------------------- calls to other services


def test_account_type_asks_auth_service_and_survives_errors(monkeypatch):
    def fake_get(url, headers, timeout):
        assert url.endswith("/users/5/account-type")
        assert headers == {"authorization": "Bearer t"}
        return httpx.Response(200, json={"userId": 5, "accountType": "VIP"}, request=httpx.Request("GET", url))

    monkeypatch.setattr(auth_client.httpx, "get", fake_get)
    assert auth_client.account_type(5, "Bearer t") == "VIP"

    def broken_get(url, headers, timeout):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(auth_client.httpx, "get", broken_get)
    assert auth_client.account_type(5, "Bearer t") is None
