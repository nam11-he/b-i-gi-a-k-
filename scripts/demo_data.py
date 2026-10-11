#!/usr/bin/env python3
"""Fills NamBeDe with demo data through the API Gateway, exactly like a client would.

Creates lecturers and students (one of them VIP), a question bank imported from CSV, practice rounds (so the ranking
has points) and vocabulary. Safe to run again: whatever already exists is reused and nothing is created twice.

    python3 scripts/demo_data.py                                   # gateway at http://localhost:8000/api
    python3 scripts/demo_data.py --api http://<host>:8000/api

Only the Python standard library is used. The admin account comes from .env (ADMIN_EMAIL, ADMIN_PASSWORD)
or from --admin-email / --admin-password.
"""

from __future__ import annotations  # the type hints below also work on the Python 3.9 that ships with macOS

import argparse
import csv
import io
import json
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

TEACHER_PASSWORD = "Teacher@123"
STUDENT_PASSWORD = "Student@123"

TEACHERS = [("teacher1@nambede.local", "Trần Thị B"), ("teacher2@nambede.local", "Lê Văn C")]
STUDENTS = [
    ("student1@nambede.local", "Nguyễn Văn A"),
    ("student2@nambede.local", "Phạm Thị D"),
    ("student3@nambede.local", "Hoàng Văn E"),
    ("student4@nambede.local", "Võ Thị F"),
]
VIP_STUDENT = "student2@nambede.local"

# Topic -> questions: (question, A, B, C, D, correct answer, explanation). Imported through the CSV import API.
QUESTIONS = {
    "Thì hiện tại đơn": [
        ("She ___ to school every day.", "go", "goes", "gone", "going", "B", "Chủ ngữ số ít ở thì hiện tại đơn: động từ thêm -es."),
        ("My father ___ coffee every morning.", "drink", "drinks", "drank", "drinking", "B", "He, she, it đi với động từ thêm -s."),
        ("They ___ English on Mondays.", "studies", "study", "studied", "studying", "B", "Chủ ngữ số nhiều giữ nguyên động từ."),
        ("Water ___ at 100 degrees Celsius.", "boil", "boiled", "boils", "boiling", "C", "Sự thật hiển nhiên dùng thì hiện tại đơn."),
        ("___ you like Vietnamese food?", "Does", "Do", "Is", "Are", "B", "Câu hỏi với you dùng trợ động từ do."),
    ],
    "Thì quá khứ đơn": [
        ("Last summer we ___ to Quy Nhon beach.", "go", "goes", "went", "gone", "C", "Last summer là mốc quá khứ nên dùng went."),
        ("She ___ her homework yesterday.", "finish", "finished", "finishes", "finishing", "B", "Yesterday là dấu hiệu của thì quá khứ đơn."),
        ("Yesterday I ___ my grandparents.", "visit", "visits", "visited", "visiting", "C", "Có yesterday nên dùng thì quá khứ đơn."),
        ("___ you see the match last night?", "Do", "Did", "Does", "Done", "B", "Câu hỏi ở quá khứ dùng trợ động từ did."),
        ("He ___ in Hue in 2010.", "lives", "live", "lived", "living", "C", "Năm 2010 đã qua nên dùng quá khứ đơn."),
    ],
    "Từ vựng trường học": [
        ("Which word means 'thư viện'?", "library", "laboratory", "canteen", "gym", "A", "Library là thư viện, laboratory là phòng thí nghiệm."),
        ("A person who teaches at a university is a ___.", "lecturer", "pupil", "librarian", "principal", "A", "Lecturer là giảng viên đại học."),
        ("The list of classes and their times is the ___.", "timetable", "textbook", "uniform", "semester", "A", "Timetable là thời khóa biểu."),
        ("Which word means 'học kỳ'?", "semester", "subject", "campus", "degree", "A", "Semester là học kỳ."),
        ("You write your answers on the exam ___.", "paper", "board", "desk", "bag", "A", "Exam paper là đề thi, bài thi."),
    ],
}
TOPIC_DESCRIPTIONS = {"Thì hiện tại đơn": "Present simple", "Thì quá khứ đơn": "Past simple", "Từ vựng trường học": "School vocabulary"}
CORRECT = {row[0]: row[5] for rows in QUESTIONS.values() for row in rows}

# (student, mode, topic or None, number of questions, positions answered wrong) - only for students without rounds yet
PRACTICE = [
    ("student1@nambede.local", "TOPIC", "Thì quá khứ đơn", 5, {3}),
    ("student2@nambede.local", "RANDOM", None, 15, set()),
    ("student3@nambede.local", "RANDOM", None, 5, {1, 2, 4}),
]

WORDS = {
    "student1@nambede.local": [("persevere", "kiên trì", "Persevere and you will succeed."),
                               ("diligent", "chăm chỉ, siêng năng", "She is a diligent student."),
                               ("campus", "khuôn viên trường", None)],
    "student2@nambede.local": [("semester", "học kỳ", "The new semester starts in September.")],
}


class Gateway:
    """JSON calls to the API Gateway with the standard library."""

    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")

    def call(self, method: str, path: str, token: str | None = None, body=None, raw: bytes | None = None, content_type: str | None = None):
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if raw is not None:
            data = raw
            headers["Content-Type"] = content_type or "application/octet-stream"
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                text = response.read().decode()
                return response.status, json.loads(text) if text else None
        except urllib.error.HTTPError as error:
            text = error.read().decode()
            try:
                return error.code, json.loads(text)
            except ValueError:
                return error.code, {"message": text}
        except urllib.error.URLError as error:
            sys.exit(f"Không gọi được gateway ở {self.base} ({error.reason}). Hệ thống đã chạy chưa? docker compose up -d")

    def ok(self, method: str, path: str, token: str | None = None, **kwargs):
        status, payload = self.call(method, path, token, **kwargs)
        if status >= 400:
            message = payload.get("message") if isinstance(payload, dict) else payload
            sys.exit(f"Lỗi {status} ở {method} {path}: {message}")
        return payload


def log(text: str) -> None:
    print(f"  ✓ {text}")


def read_env_admin() -> tuple[str, str]:
    """ADMIN_EMAIL / ADMIN_PASSWORD from the repo's .env, like docker compose uses them."""
    values = {"ADMIN_EMAIL": "admin@nambede.local", "ADMIN_PASSWORD": "Admin@123"}
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8", errors="replace").splitlines():
            key, _, value = line.partition("=")
            value = re.split(r"\s+#", value.strip(), maxsplit=1)[0].strip().strip("'\"")  # drop "  # comment" and quotes
            if key.strip() in values and value:
                values[key.strip()] = value
    return values["ADMIN_EMAIL"], values["ADMIN_PASSWORD"]


def login(api: Gateway, email: str, password: str) -> str | None:
    status, payload = api.call("POST", "/auth/login", body={"email": email, "password": password})
    if status >= 500:
        sys.exit(f"Lỗi {status} khi đăng nhập: {payload.get('message')}")
    return payload["accessToken"] if status == 200 else None


def ensure_lecturer(api: Gateway, admin: str, email: str, name: str) -> str:
    status, payload = api.call("POST", "/users", admin, body={"email": email, "password": TEACHER_PASSWORD, "fullName": name, "role": "TEACHER"})
    if status not in (201, 409):
        sys.exit(f"Không tạo được giảng viên {email}: {payload}")
    token = login(api, email, TEACHER_PASSWORD)
    if token is None:
        sys.exit(f"{email} đã có nhưng mật khẩu không phải {TEACHER_PASSWORD}")
    log(f"Giảng viên {name} <{email}> ({'mới tạo' if status == 201 else 'đã có'})")
    return token


def ensure_student(api: Gateway, email: str, name: str) -> str:
    status, payload = api.call("POST", "/auth/register", body={"email": email, "password": STUDENT_PASSWORD, "fullName": name})
    if status == 201:
        log(f"Sinh viên {name} <{email}> (tự đăng ký)")
        return payload["accessToken"]
    token = login(api, email, STUDENT_PASSWORD)
    if token is None:
        sys.exit(f"{email} đã có nhưng mật khẩu không phải {STUDENT_PASSWORD}")
    log(f"Sinh viên {name} <{email}> (đã có)")
    return token


def ensure_topic(api: Gateway, lecturer: str, name: str) -> int:
    existing = next((topic for topic in api.ok("GET", "/topics", lecturer) if topic["name"].lower() == name.lower()), None)
    if existing:
        return existing["id"]
    return api.ok("POST", "/topics", lecturer, body={"name": name, "description": TOPIC_DESCRIPTIONS.get(name, "")})["id"]


def import_questions(api: Gateway, lecturer: str, topic_id: int, rows: list[tuple]) -> dict:
    """Uses POST /questions/import with a CSV file, like a lecturer's upload; questions already there are skipped."""
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(["Câu hỏi", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng", "Giải thích"])
    writer.writerows(rows)
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="cau-hoi.csv"\r\nContent-Type: text/csv\r\n\r\n'.encode()
        + ("﻿" + text.getvalue()).encode()
        + f"\r\n--{boundary}--\r\n".encode()
    )
    return api.ok("POST", f"/questions/import?topicId={topic_id}&dryRun=false", lecturer, raw=body, content_type=f"multipart/form-data; boundary={boundary}")


def answer_letter(content: str, position: int, wrong: set[int]) -> str:
    """The right answer, except at the positions meant to be wrong (questions outside the demo set get A)."""
    correct = CORRECT.get(content, "A")
    if position in wrong:
        return "ABCD"[("ABCD".index(correct) + 1) % 4]
    return correct


def main() -> None:
    admin_email, admin_password = read_env_admin()
    parser = argparse.ArgumentParser(description="Tạo dữ liệu demo cho NamBeDe qua API Gateway.")
    parser.add_argument("--api", default="http://localhost:8000/api", help="địa chỉ gateway (mặc định http://localhost:8000/api)")
    parser.add_argument("--admin-email", default=admin_email)
    parser.add_argument("--admin-password", default=admin_password)
    args = parser.parse_args()
    api = Gateway(args.api)

    print(f"NamBeDe: tạo dữ liệu demo qua {api.base}")
    admin = login(api, args.admin_email, args.admin_password)
    if admin is None:
        sys.exit(f"Không đăng nhập được admin {args.admin_email}. Dùng --admin-email và --admin-password.")

    print("Tài khoản")
    lecturers = {email: ensure_lecturer(api, admin, email, name) for email, name in TEACHERS}
    students = {email: ensure_student(api, email, name) for email, name in STUDENTS}
    vip_id = api.ok("GET", "/users/me", students[VIP_STUDENT])["id"]
    api.ok("PUT", f"/users/{vip_id}/account-type", admin, body={"accountType": "VIP"})
    log(f"{VIP_STUDENT} lên gói VIP")

    print("Ngân hàng câu hỏi")
    teacher = lecturers["teacher1@nambede.local"]
    topic_ids = {}
    for topic, rows in QUESTIONS.items():
        topic_ids[topic] = ensure_topic(api, teacher, topic)
        result = import_questions(api, teacher, topic_ids[topic], rows)
        log(f"{topic}: nhập {result['imported']} câu từ CSV, bỏ qua {result['total'] - result['imported']} câu đã có")

    print("Luyện tập")
    for email, mode, topic, count, wrong in PRACTICE:
        token = students[email]
        if api.ok("GET", "/practice/sessions", token):
            log(f"{email} đã có lượt luyện tập, giữ nguyên")
            continue
        limit = api.ok("GET", "/practice/limit", token)
        body = {"mode": mode, "questionCount": min(count, limit["maxQuestions"])}
        if topic:
            body["topicId"] = topic_ids[topic]
        round_ = api.ok("POST", "/practice/start", token, body=body)
        answers = [{"questionId": q["id"], "chosenOption": answer_letter(q["content"], q["position"], wrong)} for q in round_["questions"]]
        result = api.ok("POST", "/practice/submit", token, body={"sessionId": round_["sessionId"], "answers": answers})
        log(f"{email} ({limit['accountType']}): {result['correctCount']} / {result['questionCount']} câu đúng, +{result['pointsEarned']} điểm")

    print("Sổ từ vựng")
    for email, words in WORDS.items():
        added = 0
        for word, meaning, example in words:
            status, _ = api.call("POST", "/vocabularies", students[email], body={"word": word, "meaning": meaning, "example": example})
            added += status == 201
        log(f"{email}: thêm {added} từ ({len(words) - added} từ đã có)")

    ranking = api.ok("GET", "/ranking/weekly?limit=5", admin)
    print("Bảng xếp hạng tuần: " + ", ".join(f"#{e['rank']} {e['fullName']} {e['points']} điểm" for e in ranking["entries"]))
    print()
    print(f"Xong. Tài khoản demo (đăng nhập ở Swagger {api.base}/docs, mục Auth Service, POST /auth/login):")
    print(f"  Quản trị viên  {args.admin_email} / {args.admin_password}")
    for email, name in TEACHERS:
        print(f"  Giảng viên     {email} / {TEACHER_PASSWORD}  ({name})")
    for email, name in STUDENTS:
        print(f"  Sinh viên      {email} / {STUDENT_PASSWORD}  ({name}{', VIP' if email == VIP_STUDENT else ''})")


if __name__ == "__main__":
    main()
