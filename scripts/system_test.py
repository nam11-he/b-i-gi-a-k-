#!/usr/bin/env python3
"""System test: drives the running system through the API Gateway, like a client, and checks that the gateway,
Auth Service and Learning Service work together.

    python3 scripts/system_test.py                                 # gateway at http://localhost:8000/api
    python3 scripts/system_test.py --api http://<host>:8000/api

Every run creates its own lecturer, students and topic (names end with a random tag), so it can run any number of
times next to the demo data. Exit code 0 when every check passed. Only the Python standard library is used.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
import uuid

from demo_data import Gateway, login, read_env_admin

PASSWORD = "System@123"
#: The gateway keeps an "open session" answer 10 s
SESSION_TIMEOUT = 20.0

failures: list[str] = []


def check(ok: bool, text: str) -> bool:
    print(f"  {'✓' if ok else '✗'} {text}")
    if not ok:
        failures.append(text)
    return ok


def eventually(probe, timeout: float):
    """Calls `probe` until it returns something truthy or the time is up; returns the last result."""
    deadline = time.monotonic() + timeout
    while True:
        result = probe()
        if result or time.monotonic() > deadline:
            return result
        time.sleep(0.5)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://localhost:8000/api", help="gateway address (default %(default)s)")
    parser.add_argument("--admin-email")
    parser.add_argument("--admin-password")
    args = parser.parse_args()
    api = Gateway(args.api)
    env_email, env_password = read_env_admin()
    admin = login(api, args.admin_email or env_email, args.admin_password or env_password)
    if admin is None:
        sys.exit("Không đăng nhập được admin: kiểm tra ADMIN_EMAIL, ADMIN_PASSWORD")

    tag = uuid.uuid4().hex[:8]
    print(f"Kiểm thử hệ thống ở {args.api} (mã lần chạy {tag})")

    print("Chuẩn bị: giảng viên, 2 sinh viên, chủ đề có 1 câu hỏi")
    api.ok("POST", "/users", admin, body={"email": f"gv-{tag}@test.local", "password": PASSWORD, "fullName": f"GV {tag}", "role": "TEACHER"})
    teacher = login(api, f"gv-{tag}@test.local", PASSWORD)
    students = {}
    for name in ("sv1", "sv2"):
        payload = api.ok("POST", "/auth/register", body={"email": f"{name}-{tag}@test.local", "password": PASSWORD, "fullName": f"{name.upper()} {tag}"})
        students[name] = (payload["user"]["id"], payload["accessToken"])
    sv1_id, sv1 = students["sv1"]
    sv2_id, sv2 = students["sv2"]
    topic = api.ok("POST", "/topics", teacher, body={"name": f"Chủ đề {tag}"})
    api.ok("POST", "/questions", teacher, body={
        "topicId": topic["id"], "content": f"Câu hỏi {tag}?", "optionA": "a", "optionB": "b", "optionC": "c", "optionD": "d", "correctOption": "B"})
    check(True, f"chủ đề {topic['id']}, sinh viên {sv1_id} và {sv2_id}")

    print("Swagger chung: bản mô tả API của từng service, lấy qua gateway")
    for service in ("auth-service", "learning-service"):
        status, spec = api.call("GET", f"/docs/{service}.json")
        paths = spec.get("paths", {}) if status == 200 else {}
        check(bool(paths) and spec["servers"][0]["url"] == "/api", f"{service}: {len(paths)} đường dẫn, gọi thử đi qua /api")

    print("Gateway kiểm tra token, các service kiểm tra vai trò; Learning Service lấy họ tên từ Auth Service")
    check(api.call("GET", "/topics")[0] == 401, "không có token: 401")
    check(api.call("GET", "/questions", sv1)[0] == 403, "sinh viên không xem được ngân hàng câu hỏi (lộ đáp án): 403")
    check(api.call("GET", "/users", sv1)[0] == 403, "sinh viên không quản lý được người dùng: 403")
    mine = next((item for item in api.ok("GET", "/topics", sv1) if item["id"] == topic["id"]), None)
    check(mine is not None and mine["questionCount"] == 1 and mine["createdByName"] == f"GV {tag}",
          f"sinh viên xem được chủ đề, kèm họ tên người tạo \"GV {tag}\"")

    print("X-Request-ID: gateway trả lại mã của request")
    request = urllib.request.Request(f"{args.api}/topics", headers={"Authorization": f"Bearer {teacher}", "X-Request-ID": f"system-test-{tag}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        json.load(response)
        check(response.headers.get("X-Request-ID") == f"system-test-{tag}", f"giữ mã system-test-{tag} (tìm trong log: docker compose logs | grep system-test-{tag})")

    print("Luyện tập: Learning Service hỏi Auth Service gói FREE / VIP")
    limit = api.ok("GET", "/practice/limit", sv1)
    check(limit == {"accountType": "FREE", "maxQuestions": 20, "accountTypeChecked": True}, "sv1 gói FREE: tối đa 20 câu mỗi lượt")
    check(api.call("POST", "/practice/start", sv1, body={"mode": "RANDOM", "questionCount": 30})[0] == 403, "xin 30 câu: 403")
    round_ = api.ok("POST", "/practice/start", sv1, body={"mode": "TOPIC", "topicId": topic["id"], "questionCount": 5})
    question = round_["questions"][0]
    check(round_["questionCount"] == 1 and question["correctOption"] is None, "chủ đề chỉ có 1 câu nên lượt có 1 câu, chưa lộ đáp án")
    result = api.ok("POST", "/practice/submit", sv1, body={"sessionId": round_["sessionId"], "answers": [{"questionId": question["id"], "chosenOption": "B"}]})
    check(result["score"] == 10 and result["pointsEarned"] == 11, "nộp lượt: 10 điểm, +11 điểm hoạt động (10 + 1 câu đúng)")
    check(api.ok("GET", "/streak", sv1)["currentStreak"] == 1, "streak 1 ngày")
    me = api.ok("GET", "/ranking/weekly?limit=0", sv1)["me"]
    check(me["totalPoints"] == 11 and me["rank"] is not None, f"có tên trên bảng xếp hạng tuần (hạng {me['rank']}, 11 điểm)")

    print("VIP: admin đổi gói, Learning Service thấy ngay, không phải đăng nhập lại")
    api.ok("PUT", f"/users/{sv2_id}/account-type", admin, body={"accountType": "VIP"})
    check(api.ok("GET", "/practice/limit", sv2)["maxQuestions"] == 50, "sv2 gói VIP: tối đa 50 câu mỗi lượt")

    print("BFF: một request, gateway gộp dữ liệu của Auth Service và Learning Service")
    dashboard = api.ok("GET", "/dashboard/student", sv1)
    check(dashboard["student"]["name"] == f"SV1 {tag}" and dashboard["streak"] == 1 and dashboard["points"] == 11,
          "hồ sơ (Auth Service) cùng streak và điểm (Learning Service)")

    print("Phiên đăng nhập: khóa tài khoản thì token đang dùng bị từ chối, không phải chờ hết hạn")
    check(api.call("GET", "/streak", sv2)[0] == 200, "sv2 dùng token bình thường")
    api.ok("PUT", f"/users/{sv2_id}/status", admin, body={"status": "LOCKED"})

    def sv2_refused():
        status, body = api.call("GET", "/streak", sv2)
        return body if status == 401 else None

    refused = eventually(sv2_refused, SESSION_TIMEOUT)
    check(bool(refused) and refused.get("message") == "Account is locked", "admin khóa sv2: token cũ bị 401 \"Account is locked\" trong vòng 10 giây")
    api.ok("PUT", f"/users/{sv2_id}/status", admin, body={"status": "ACTIVE"})
    sv2_again = login(api, f"sv2-{tag}@test.local", PASSWORD)
    check(sv2_again is not None and api.call("GET", "/streak", sv2_again)[0] == 200, "mở khóa, sv2 đăng nhập lại được")

    print()
    if failures:
        sys.exit(f"{len(failures)} kiểm tra không đạt: " + "; ".join(failures))
    print("Mọi kiểm tra đều đạt.")


if __name__ == "__main__":
    main()
