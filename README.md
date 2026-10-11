# NamBeDe (bản giữa kỳ)

Ứng dụng học tập theo kiến trúc **SOA (Service-Oriented Architecture)**: giảng viên soạn ngân hàng câu hỏi, sinh viên luyện tập, ôn từ vựng và thi đua trên bảng xếp hạng tuần. Mỗi service có database riêng, client chỉ giao tiếp qua một API Gateway.

Bản giữa kỳ trình bày **phần Python** của hệ thống: **API Gateway** và **Learning Service** viết bằng **FastAPI**. Hai service này cần đăng nhập và JWT, nên bản giữa kỳ mang theo đúng một service nữa là **Auth Service** (Spring Boot), giữ nguyên không sửa, cùng **giao diện web** (React) rút gọn cho đúng các chức năng đó.

Tài liệu: [hướng dẫn chạy và kịch bản demo](docs/HUONG-DAN.md), [danh sách API](docs/API.md). Web ở http://nambede.dev.localhost; thử mọi API ngay trên trình duyệt: Swagger chung ở http://localhost:8000/docs.

## Kiến trúc

```text
        Web (React)              Swagger, curl, script
  http://nambede.dev.localhost             │
             │                             │
             └─────────┬───────────────────┘
                       ▼
             ┌───────────────────┐
             │  FastAPI Gateway  │  :8000  kiểm tra JWT, định tuyến, gộp dữ liệu (BFF), X-Request-ID
             └─────────┬─────────┘
             ┌─────────┴──────────┐
             ▼                    ▼
       Auth Service        Learning Service
       Spring Boot         FastAPI
         :8081               :8084
             │                    │
          auth_db            learning_db
             └── PostgreSQL 17 ───┘
```

| Thành phần | Công nghệ | Cổng | Database | Thư mục | Trách nhiệm |
|---|---|---|---|---|---|
| Web | React 19 + Vite, nginx | 80 | | `web` | Giao diện: đăng nhập, tổng quan, ngân hàng câu hỏi, luyện tập, từ vựng, xếp hạng, quản lý người dùng |
| Gateway / BFF | FastAPI | 8000 | | `services/gateway` | Điểm vào duy nhất, kiểm tra JWT, định tuyến, gộp dữ liệu |
| Learning Service | FastAPI | 8084 | `learning_db` | `services/learning-service` | Chủ đề, ngân hàng câu hỏi, nhập Excel / CSV, luyện tập, từ vựng, streak, xếp hạng |
| Auth Service | Spring Boot 4 | 8081 | `auth_db` | `services/auth-service` | Người dùng, đăng nhập, JWT, vai trò, trạng thái, FREE/VIP |

Nguyên tắc:

- Client chỉ gọi gateway. Gateway chuyển `/api/<tiền tố>/...` tới service phụ trách. Web gọi `/api` trên chính domain của nó, nginx chuyển tiếp tới gateway.
- Mỗi service chỉ đọc database của chính nó. Cần dữ liệu của service khác thì gọi REST API của service đó.
- JWT ký **RS256** chỉ ở Auth Service (khóa riêng tự tạo lần đầu, lưu trong `auth_db`); gateway và Learning Service kiểm tra bằng khóa công khai ở `GET /.well-known/jwks.json`, nên không service nào khác tự tạo được token. Gateway còn hỏi Auth Service phiên đăng nhập còn mở không (`GET /auth/session`, lưu đệm 10 giây): admin khóa tài khoản hay đổi vai trò thì token cũ hết dùng được trong vòng 10 giây.
- Lỗi có chung dạng `{"status", "error", "message", "path"}`. Gateway trả **502** khi một service không truy cập được, service còn lại vẫn chạy bình thường.
- Sinh viên tự đăng ký. Giảng viên và admin do admin tạo, không có đăng ký admin công khai.
- Service gọi service qua REST, kể cả giữa hai công nghệ: Learning Service (FastAPI) gọi Auth Service (Spring Boot) `GET /users/lookup` để lấy họ tên. Nếu Auth Service lỗi, dữ liệu vẫn trả về, chỉ thiếu họ tên.
- Learning Service hỏi Auth Service gói FREE / VIP trước mỗi lượt luyện tập (FREE tối đa 20 câu, VIP 50 câu). Auth Service không trả lời thì tạm tính FREE.
- Lượt luyện tập lưu **bản sao nội dung câu hỏi** (bảng `practice_answers`). Giảng viên sửa câu hỏi trong ngân hàng sau đó không làm thay đổi lượt đang làm và điểm đã có.

## Chạy hệ thống

Máy chỉ cần **Docker** (Docker Desktop trên Windows và macOS) và **Python 3.9 trở lên** (để chạy script dữ liệu demo và kiểm thử). Java, Maven, Node, uv đều chạy trong container.

| | macOS, Linux | Windows |
|---|---|---|
| Dựng toàn bộ: hệ thống và dữ liệu demo | `make deploy` | hai bước dưới |
| 1. Dựng hệ thống | `make up` | `copy .env.example .env`, rồi `docker compose up -d --build --wait` |
| 2. Tạo dữ liệu demo | `make seed` | `py scripts\demo_data.py` |
| 3. Kiểm thử cả hệ thống | `make system-test` | `py scripts\system_test.py` |
| Dừng, giữ dữ liệu | `make stop` | `docker compose stop` |
| Xóa toàn bộ dữ liệu | `make down` | `docker compose down -v` |

`make up` tạo `.env` từ `.env.example` nếu chưa có (không có bí mật nào phải điền: Auth Service tự tạo khóa ký token), build rồi chạy 5 container (PostgreSQL, Auth Service, Learning Service, gateway, web) và chờ tất cả healthy. Lần đầu mất vài phút để tải Maven và các thư viện; Auth Service chạy test khi build, đặt `SKIP_TESTS=true` trong `.env` để bỏ qua. Container và volume dữ liệu có tên `nambede-midterm-*`. Gõ `make` để xem danh sách lệnh.

- Web: **http://nambede.dev.localhost**. Domain `*.localhost` tự trỏ về máy mình, không cần sửa `/etc/hosts` (không mở được thì dùng http://localhost). Nếu cổng 80 đã bị dùng, đổi `WEB_PORT` trong `.env` và thêm `:<cổng>` vào URL.
- Swagger chung của cả hệ thống: http://localhost:8000/docs. Menu phía trên chọn gateway hoặc từng service, mọi lần gọi thử đều đi qua gateway; đăng nhập ở mục Auth Service rồi bấm **Authorize** một lần là dùng được cho cả hai service.
- Tài khoản admin mặc định: `admin@nambede.local` / `Admin@123` (đổi bằng `ADMIN_EMAIL`, `ADMIN_PASSWORD` trong `.env` trước lần chạy đầu).
- **Dữ liệu demo** (`make seed`) tạo sẵn 2 giảng viên, 4 sinh viên (một tài khoản VIP), 3 chủ đề với 15 câu hỏi nhập từ CSV, lượt luyện tập, từ vựng và bảng xếp hạng. Script gọi qua gateway như một client, in ra danh sách tài khoản; chạy lại không tạo trùng.

## Kiểm tra nhanh bằng curl

Đăng nhập, phân quyền, gateway trả 502 khi một service tắt. Chạy ở thư mục gốc của repo.

```bash
G=http://localhost:8000/api
TOKEN=$(curl -s -X POST $G/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@nambede.local","password":"Admin@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s $G/users/me -H "Authorization: Bearer $TOKEN"            # 200: thông tin admin
curl -s -i $G/users/me | head -1                                   # 401: thiếu token

curl -s -X POST $G/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"hs1@nambede.local","password":"Student@123","fullName":"Nguyễn Văn A"}'
STOKEN=$(curl -s -X POST $G/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"hs1@nambede.local","password":"Student@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
curl -s $G/users -H "Authorization: Bearer $STOKEN"                # 403: sinh viên không quản lý người dùng
curl -s $G/topics/ping -H "Authorization: Bearer $STOKEN"          # 200: gateway -> learning-service, token được kiểm tra ở cả hai
curl -s $G/dashboard/student -H "Authorization: Bearer $STOKEN"    # BFF: một request, gateway gộp Auth Service và Learning Service

docker compose stop learning-service
curl -s $G/topics/ping -H "Authorization: Bearer $STOKEN"          # 502: learning-service is unavailable
curl -s $G/dashboard/student -H "Authorization: Bearer $STOKEN"    # vẫn 200: hồ sơ còn, streak, points, weeklyRank là null
docker compose start learning-service                              # chờ vài giây cho service lên lại
```

Ngân hàng câu hỏi: admin tạo giảng viên, giảng viên tạo chủ đề và câu hỏi trắc nghiệm, sinh viên không xem được câu hỏi. Chạy tiếp sau khối lệnh trên.

```bash
curl -s -X POST $G/users -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"gv1@nambede.local","password":"Teacher@123","fullName":"Trần Thị B","role":"TEACHER"}'
TTOKEN=$(curl -s -X POST $G/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"gv1@nambede.local","password":"Teacher@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
TOPIC=$(curl -s -X POST $G/topics -H "Authorization: Bearer $TTOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Ôn tập thì hiện tại"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X POST $G/questions -H "Authorization: Bearer $TTOKEN" -H 'Content-Type: application/json' \
  -d "{\"topicId\":$TOPIC,\"content\":\"She ___ to school every day.\",\"optionA\":\"go\",\"optionB\":\"goes\",\"optionC\":\"gone\",\"optionD\":\"going\",\"correctOption\":\"B\"}"
curl -s $G/topics -H "Authorization: Bearer $STOKEN"               # sinh viên xem được chủ đề, kèm họ tên người tạo (Learning hỏi Auth)
curl -s -i $G/questions -H "Authorization: Bearer $STOKEN" | head -1 # 403: sinh viên không xem được câu hỏi
```

Luyện tập, từ vựng, streak và xếp hạng: Learning Service hỏi Auth Service gói tài khoản; giảng viên sửa đáp án khi lượt đang làm nhưng điểm không đổi vì lượt luyện tập giữ bản sao câu hỏi. Chạy tiếp sau các khối lệnh trên.

```bash
curl -s $G/practice/limit -H "Authorization: Bearer $STOKEN"       # FREE: tối đa 20 câu mỗi lượt
curl -s -X POST $G/practice/start -H "Authorization: Bearer $STOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"RANDOM","questionCount":30}'                        # 403: FREE chỉ luyện tối đa 20 câu
ROUND=$(curl -s -X POST $G/practice/start -H "Authorization: Bearer $STOKEN" -H 'Content-Type: application/json' \
  -d "{\"mode\":\"TOPIC\",\"topicId\":$TOPIC,\"questionCount\":5}")
RID=$(echo "$ROUND" | python3 -c 'import sys,json;print(json.load(sys.stdin)["sessionId"])')
PQ=$(echo "$ROUND" | python3 -c 'import sys,json;print(json.load(sys.stdin)["questions"][0]["id"])')
curl -s -X PUT $G/questions/$PQ -H "Authorization: Bearer $TTOKEN" -H 'Content-Type: application/json' \
  -d "{\"topicId\":$TOPIC,\"content\":\"She ___ to school every day.\",\"optionA\":\"go\",\"optionB\":\"goes\",\"optionC\":\"gone\",\"optionD\":\"going\",\"correctOption\":\"A\"}"
curl -s -X POST $G/practice/submit -H "Authorization: Bearer $STOKEN" -H 'Content-Type: application/json' \
  -d "{\"sessionId\":$RID,\"answers\":[{\"questionId\":$PQ,\"chosenOption\":\"B\"}]}"  # "score":10.0, "pointsEarned":11: chấm theo bản sao, đáp án đúng vẫn là B
curl -s -X POST $G/vocabularies -H "Authorization: Bearer $STOKEN" -H 'Content-Type: application/json' \
  -d '{"word":"persevere","meaning":"kiên trì"}'                   # sổ từ riêng của sinh viên
curl -s $G/streak -H "Authorization: Bearer $STOKEN"               # "currentStreak": 1
curl -s $G/ranking/weekly -H "Authorization: Bearer $STOKEN"       # 11 điểm: 10 cho lượt luyện tập, 1 cho câu đúng
SUID=$(curl -s $G/users/me -H "Authorization: Bearer $STOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
curl -s -X PUT $G/users/$SUID/account-type -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"accountType":"VIP"}'                                       # admin nâng sinh viên lên VIP
curl -s $G/practice/limit -H "Authorization: Bearer $STOKEN"       # VIP: tối đa 50 câu mỗi lượt, không phải đăng nhập lại
curl -s $G/dashboard/student -H "Authorization: Bearer $STOKEN"    # hồ sơ (Auth) cùng streak, points, weeklyRank (Learning)
```

Tài khoản và nhập câu hỏi từ Excel: giảng viên tự đổi họ tên, mật khẩu, rồi nhập câu hỏi từ file mẫu. Chạy tiếp sau các khối lệnh trên.

```bash
curl -s -X PUT $G/users/me -H "Authorization: Bearer $TTOKEN" -H 'Content-Type: application/json' \
  -d '{"fullName":"Trần Thị Bích"}'                                # tự đổi họ tên
curl -s -o /dev/null -w '%{http_code}\n' -X PUT $G/users/me/password -H "Authorization: Bearer $TTOKEN" \
  -H 'Content-Type: application/json' -d '{"currentPassword":"Teacher@123","newPassword":"Teacher@456"}'  # 204, sai mật khẩu cũ thì 403
curl -s -o mau-cau-hoi.xlsx $G/questions/import/template -H "Authorization: Bearer $TTOKEN"   # file Excel mẫu
curl -s -X POST "$G/questions/import?topicId=$TOPIC&dryRun=true" -H "Authorization: Bearer $TTOKEN" \
  -F "file=@mau-cau-hoi.xlsx"                                      # xem trước: câu ví dụ đầu trùng câu đã có, câu thứ hai nhập được
curl -s -X POST "$G/questions/import?topicId=$TOPIC" -H "Authorization: Bearer $TTOKEN" \
  -F "file=@mau-cau-hoi.xlsx"                                      # "imported": 1
```

## Phát triển

| Việc | Lệnh |
|---|---|
| Build lại một service | `docker compose up -d --build learning-service` |
| Xem log | `make logs`, hoặc `docker compose logs -f gateway` |
| Lần theo một request qua mọi service | `docker compose logs \| grep <X-Request-ID>` (mã nằm trong header trả về của gateway) |
| Build Java nhanh, bỏ test | đặt `SKIP_TESTS=true` trong `.env` |
| Test gateway và Learning Service | `make test`: pytest chạy trong container, không cần cài uv. Máy có uv: `cd services/gateway && uv run pytest` |
| Test Auth Service (không cần cài Java) | xem `services/auth-service/README.md` |
| Test web | `cd web && npm test` (Vitest); lint và build: `npm run lint`, `npm run build` |
| Giao diện với hot reload | `cd web && npm install && npm run dev` (http://localhost:5173, Vite chuyển `/api` tới gateway) |
| Kiểm thử toàn hệ thống (đang chạy) | `make system-test`: qua gateway như client |
| Tạo dữ liệu demo | `make seed`, hoặc `python3 scripts/demo_data.py --api http://<máy>:8000/api` khi gateway ở máy khác |
| Xóa toàn bộ dữ liệu, tạo lại 2 database | `make down` rồi `make up` |

**CI**: `.gitlab-ci.yml` có 5 job: `auth-service` (Maven `verify`), `gateway`, `learning-service` (`pytest`), `web` (lint, unit test và build), `system-test` (dựng cả hệ thống bằng Docker-in-Docker rồi chạy `scripts/system_test.py`; cần runner cho phép `privileged`). Mỗi job chỉ chạy khi thư mục của nó thay đổi. Chạy thử một job trên máy mình: `npx gitlab-ci-local gateway`.

Thêm một service mới: tạo thư mục trong `services/`, thêm database vào `infra/postgres/init/01-create-databases.sql` (volume cũ không chạy lại file này: `make down` để tạo lại), thêm service và healthcheck vào `docker-compose.yml`, khai báo tiền tố trong `services/gateway/src/gateway/routes.py`, địa chỉ trong `config.py` và bản mô tả API trong `SPECS` của `docs.py`, thêm job vào `.gitlab-ci.yml`.

## Phạm vi

| | Nội dung |
|---|---|
| Giữa kỳ (bản này) | **Gateway**: định tuyến theo tiền tố, kiểm tra JWT RS256 bằng JWKS, thu hồi phiên trong 10 giây, 502 khi service tắt, `X-Request-ID` trên mọi dòng log, Swagger chung, dashboard BFF. **Learning Service**: chủ đề, ngân hàng câu hỏi dùng chung, nhập câu hỏi từ Excel / CSV, luyện tập FREE / VIP với bản sao câu hỏi, sổ từ vựng, streak, điểm hoạt động, bảng xếp hạng tuần. **Auth Service**: đăng ký, đăng nhập, JWT, vai trò, khóa tài khoản, gói FREE / VIP. **Web**: đăng nhập, đăng ký, tổng quan theo vai trò, ngân hàng câu hỏi và nhập Excel, luyện tập, sổ từ vựng, xếp hạng tuần, tài khoản, quản lý người dùng. Test cho từng phần, kiểm thử toàn hệ thống, CI |
| Trình bày cuối kỳ | Class Service (lớp học, mã lớp) và Exercise Service (giao bài, làm bài, chấm điểm) cùng các trang tương ứng trên web, Notification Service và chuông thông báo, sự kiện giữa các service qua RabbitMQ, ứng dụng Android |
