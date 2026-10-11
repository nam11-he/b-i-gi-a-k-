# Tài liệu API NamBeDe (bản giữa kỳ)

Tài liệu này mô tả API của bản giữa kỳ mà web dùng: API Gateway, Auth Service và Learning Service. Mọi lời gọi đều đi qua **API Gateway**; client không bao giờ gọi thẳng một service.

| Cách gọi | Địa chỉ gốc |
|---|---|
| Trình duyệt, cùng domain với web | `http://nambede.dev.localhost/api` |
| Gọi thẳng gateway trên máy chạy Docker | `http://localhost:8000/api` |
| Từ máy khác trong cùng mạng | `http://<địa chỉ IP của máy chạy Docker>:8000/api` |

Trong tài liệu, đường dẫn được viết **sau** `/api`. Ví dụ `GET /topics` nghĩa là `GET http://localhost:8000/api/topics`.

Thử trực tiếp: **Swagger chung** ở `http://localhost:8000/docs`. Menu phía trên chọn gateway hoặc một service; đăng nhập bằng `POST /auth/login` ở mục Auth Service, chép `accessToken`, bấm **Authorize**. Mọi lần gọi thử đều đi qua gateway như web. Swagger được sinh từ code nên luôn khớp API thật; tài liệu này bổ sung ví dụ JSON và quy tắc nghiệp vụ.

## Mục lục

1. [Quy ước chung](#1-quy-ước-chung)
2. [Gateway: sức khỏe, định tuyến, dashboard gộp dữ liệu](#2-gateway)
3. [Auth Service: đăng nhập, người dùng](#3-auth-service)
4. [Learning Service: chủ đề, câu hỏi, luyện tập, từ vựng, streak, xếp hạng](#4-learning-service)
5. [Lời gọi giữa các service](#5-lời-gọi-giữa-các-service)
6. [Ví dụ một phiên làm việc bằng curl](#6-ví-dụ-một-phiên-làm-việc-bằng-curl)

---

## 1. Quy ước chung

### Xác thực bằng JWT

- Đăng nhập bằng `POST /auth/login`, nhận `accessToken`. Các lời gọi sau gửi header `Authorization: Bearer <accessToken>`.
- Token do Auth Service ký bằng **RS256** (header có `kid`), hết hạn sau `JWT_EXPIRATION_MINUTES` phút (mặc định 1440, tức 24 giờ). Khóa công khai để kiểm tra ở `GET http://localhost:8081/.well-known/jwks.json` (JWK Set; gọi trong mạng Docker, không qua gateway).
- Token có claim `ver`. Admin khóa tài khoản hoặc đổi vai trò thì mọi token đã phát của người đó bị gateway từ chối trong vòng 10 giây: 401 với `message` là `"Account is locked"`, `"Session ended, sign in again"` hoặc `"This account no longer exists"`. Gateway hỏi `GET /auth/session` để biết (mục 3).
- Nội dung token: `sub` (id người dùng, dạng chuỗi), `email`, `name`, `role`, `ver`, `iss` = `nambede-auth`, `iat`, `exp`.
- Gateway kiểm tra token cho mọi đường dẫn trừ `/auth/*` và `/health`. Từng service kiểm tra lại token, nên gọi thẳng service mà không có token cũng bị từ chối.

### Vai trò

| Vai trò | Ý nghĩa | Tạo bằng cách nào |
|---|---|---|
| `ADMIN` | Quản trị viên | Tài khoản đầu tiên tạo từ `ADMIN_EMAIL`, `ADMIN_PASSWORD`; các admin khác do admin tạo |
| `TEACHER` | Giảng viên | Admin tạo (`POST /users`) |
| `STUDENT` | Sinh viên | Tự đăng ký (`POST /auth/register`) hoặc admin tạo |

Sinh viên có thêm gói tài khoản `FREE` hoặc `VIP` (admin đổi). Tài khoản có trạng thái `ACTIVE` hoặc `LOCKED` (bị khóa thì không đăng nhập được).

### Dữ liệu

- Body và kết quả là JSON, tên trường kiểu camelCase (`fullName`, `correctOption`).
- Thời gian theo chuẩn ISO 8601, múi giờ UTC, ví dụ `2026-10-08T23:59:00Z`. Ngày không có giờ (streak, tuần xếp hạng) theo giờ Việt Nam, ví dụ `2026-09-28`.
- Điểm luyện tập theo thang 10, làm tròn 2 chữ số: `6.67`.

### Lỗi

Mọi service và gateway trả lỗi cùng một dạng:

```json
{"status": 403, "error": "Forbidden", "message": "You do not have permission to perform this action", "path": "/users"}
```

| Mã | Khi nào |
|---|---|
| 400 | Dữ liệu gửi lên sai, `message` ghi trường bị sai, ví dụ `"newPassword: must be at most 72 bytes; an accented letter takes 2 to 3 bytes"` |
| 401 | Thiếu token, token sai hoặc hết hạn; đăng nhập sai email hoặc mật khẩu |
| 403 | Đúng người nhưng không đủ quyền: sai vai trò, không phải người soạn, lượt luyện tập của người khác, xin nhiều câu hơn gói FREE / VIP cho phép, tài khoản bị khóa |
| 404 | Không có dữ liệu với id đó |
| 409 | Xung đột: email đã dùng, tên chủ đề trùng, chủ đề còn câu hỏi, lượt luyện tập đã nộp, chưa có câu hỏi để luyện, từ đã có trong sổ |
| 429 | Đăng nhập sai quá nhiều lần với một email; header `Retry-After` ghi số giây phải chờ |
| 502 | Gateway không gọi được service phía sau, ví dụ `"learning-service is unavailable"`. Learning Service chưa đọc được khóa công khai của Auth Service cũng trả 502 |
| 500 | Lỗi không lường trước, `message` luôn là `"Internal server error"` |

---

## 2. Gateway

FastAPI, cổng `8000`, không có database. Swagger chung của cả hệ thống: `http://localhost:8000/docs` (cũng mở được ở `/api/docs`); bản mô tả API của gateway: `/api/openapi.json`, của từng service qua gateway: `/api/docs/<tên service>.json`.

### Định tuyến

Gateway chuyển nguyên request (method, đường dẫn, query, body, header `Authorization`) tới service phụ trách và trả nguyên kết quả về. Đường dẫn không thuộc tiền tố nào: 404.

| Tiền tố | Service | Cần token ở gateway |
|---|---|---|
| `/auth/*` | auth-service | không |
| `/users/*` | auth-service | có |
| `/topics/*`, `/questions/*`, `/practice/*`, `/vocabularies/*`, `/streak`, `/ranking/*` | learning-service | có |

### Mã request: `X-Request-ID`

Mỗi request qua gateway có một mã. Client gửi kèm header `X-Request-ID` (chữ, số, `.`, `_`, `-`, tối đa 64 ký tự) thì gateway dùng mã đó, không thì tự tạo (32 ký tự hex). Mã được trả lại trong header `X-Request-ID` của câu trả lời (kể cả lỗi), được chuyển sang service phía sau và sang các lời gọi giữa service. Mọi service ghi mã này trên từng dòng log, nên khi gặp lỗi chỉ cần mã đó là tìm được toàn bộ đường đi: `docker compose logs | grep <mã>`.

### `GET /health`

Công khai. Gateway còn sống.

```json
{"status": "UP", "service": "gateway"}
```

### `GET /dashboard/student`

Chỉ `STUDENT`. Đây là ví dụ **BFF**: client gọi một lần, gateway gọi song song Auth Service và Learning Service rồi gộp kết quả.

| Trường | Lấy từ |
|---|---|
| `student` | Auth Service `GET /users/me` |
| `streak` | Learning Service `GET /streak`: chuỗi ngày học hiện tại |
| `points`, `weeklyRank` | Learning Service `GET /ranking/weekly?limit=0`: tổng điểm hoạt động và hạng tuần này |

```json
{
  "student": {"id": 2, "name": "Nguyễn Văn A", "email": "student1@nambede.local", "role": "STUDENT", "accountType": "FREE"},
  "streak": 1,
  "points": 14,
  "weeklyRank": 2
}
```

Learning Service không trả lời được thì `streak`, `points`, `weeklyRank` là `null`, hồ sơ vẫn có. Chỉ khi Auth Service không trả lời thì cả request trả 502.

---

## 3. Auth Service

Spring Boot, cổng `8081`, database `auth_db` (bảng `users`, `signing_keys`, `outbox_events`).

| Method | Path | Ai được gọi | Mô tả |
|---|---|---|---|
| POST | `/auth/login` | công khai | Đăng nhập |
| POST | `/auth/register` | công khai | Sinh viên tự đăng ký |
| GET | `/users/me` | đã đăng nhập | Thông tin của mình |
| PUT | `/users/me` | đã đăng nhập | Đổi họ tên của mình |
| PUT | `/users/me/password` | đã đăng nhập | Đổi mật khẩu của mình |
| GET | `/users?role=` | ADMIN | Danh sách người dùng, lọc theo vai trò |
| POST | `/users` | ADMIN | Tạo tài khoản với vai trò bất kỳ |
| GET | `/users/{id}` | đã đăng nhập | Một người dùng |
| GET | `/users/lookup?ids=1,2,3` | đã đăng nhập | Nhiều người dùng một lần (tối đa 500 id) |
| GET | `/users/{id}/account-type` | đã đăng nhập | Gói FREE / VIP |
| PUT | `/users/{id}` | ADMIN | Đổi họ tên |
| PUT | `/users/{id}/role` | ADMIN | Đổi vai trò (không đổi được của chính mình) |
| PUT | `/users/{id}/status` | ADMIN | Khóa, mở khóa (không tự khóa mình) |
| PUT | `/users/{id}/account-type` | ADMIN | Chuyển FREE / VIP |
| DELETE | `/users/{id}` | ADMIN | Xóa tài khoản (không tự xóa mình), trả 204 |

### `POST /auth/login`

```json
{"email": "student1@nambede.local", "password": "Student@123"}
```

Kết quả:

```json
{
  "accessToken": "eyJraWQiOiJvZk9hdzBVVjQ1Um0wM0hkIiwiYWxnIjoiUlMyNTYifQ…",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {"id": 2, "email": "student1@nambede.local", "fullName": "Nguyễn Văn A", "role": "STUDENT",
           "status": "ACTIVE", "accountType": "FREE", "createdAt": "2026-10-01T05:34:26.669320Z"}
}
```

Lỗi: 401 `"Invalid email or password"`, 403 `"Account is locked"`. Sai mật khẩu 5 lần trong 5 phút với cùng một email thì email đó bị chặn đăng nhập (kể cả khi nhập đúng) tới khi lần sai đầu tiên cũ hơn 5 phút: **429** `"Too many failed sign-ins, try again in 240 seconds"` kèm header `Retry-After: 240`. Đăng nhập đúng thì đếm lại từ đầu. Đếm theo email, không theo IP, vì sau Docker gần như mọi client tới từ cùng một địa chỉ.

### `GET /auth/session`

Header `Authorization: Bearer <token>`. Trả **204** khi token còn dùng được: chữ ký đúng, chưa hết hạn, người dùng còn tồn tại, không bị khóa, và `ver` trong token bằng `token_version` hiện tại. Không thì **401** kèm lý do: `"Invalid or expired token"`, `"This account no longer exists"`, `"Account is locked"`, `"Session ended, sign in again"`. Gateway gọi API này cho mỗi request có token và giữ câu trả lời 204 trong 10 giây cho mỗi người dùng.

### `GET /.well-known/jwks.json`

Công khai, không cần token, gọi thẳng Auth Service (cổng 8081). Trả khóa công khai RS256 dạng JWK Set, gateway và Learning Service dùng để kiểm tra chữ ký:

```json
{"keys": [{"kty": "RSA", "use": "sig", "alg": "RS256", "kid": "ofOaw0UV45Rm03Hd", "n": "u1Sx...", "e": "AQAB"}]}
```

### `POST /auth/register`

```json
{"email": "hs1@nambede.local", "password": "Student@123", "fullName": "Nguyễn Văn A"}
```

Trả 201, cùng dạng với đăng nhập. Tài khoản tạo ra luôn là `STUDENT`. Mật khẩu từ 6 ký tự đến 72 **byte** (giới hạn của bcrypt; một chữ có dấu chiếm 2 đến 3 byte, nên mật khẩu tiếng Việt có dấu ngắn hơn 72 ký tự vẫn có thể bị từ chối với 400). Email đã có thì 409.

### Thông tin người dùng

`GET /users/me`, `GET /users/{id}` và các lệnh của admin trả về:

```json
{"id": 2, "email": "student1@nambede.local", "fullName": "Nguyễn Văn A", "role": "STUDENT",
 "status": "ACTIVE", "accountType": "FREE", "createdAt": "2026-10-01T05:34:26.669320Z"}
```

`GET /users/{id}/account-type`:

```json
{"userId": 2, "accountType": "FREE"}
```

### Tự đổi họ tên và mật khẩu

- `PUT /users/me` với `{"fullName": "Nguyễn Văn An"}` trả về thông tin mới.
- `PUT /users/me/password` với `{"currentPassword": "Student@123", "newPassword": "Moi@2026"}` trả 204. Sai mật khẩu hiện tại thì **403** (không phải 401, để phiên đăng nhập không bị xóa). Mật khẩu mới trùng mật khẩu cũ thì 400.

### Lệnh của admin

| Lệnh | Body |
|---|---|
| `POST /users` | `{"email", "password", "fullName", "role": "TEACHER"}` |
| `PUT /users/{id}` | `{"fullName"}` |
| `PUT /users/{id}/role` | `{"role": "ADMIN" \| "TEACHER" \| "STUDENT"}` |
| `PUT /users/{id}/status` | `{"status": "ACTIVE" \| "LOCKED"}` |
| `PUT /users/{id}/account-type` | `{"accountType": "FREE" \| "VIP"}` |

Xóa người dùng: Auth Service ghi sự kiện `user.deleted` vào bảng `outbox_events` để báo cho các service khác. Bản giữa kỳ chưa có RabbitMQ nên sự kiện nằm chờ trong bảng; lượt luyện tập, từ vựng và điểm của sinh viên đã xóa vẫn còn ở Learning Service (bảng xếp hạng hiện người đó không có họ tên).

---

## 4. Learning Service

FastAPI, cổng `8084`, database `learning_db` (bảng `topics`, `questions`, `practice_sessions`, `practice_answers`, `vocabularies`, `student_streak`, `student_points`). Swagger riêng của service: `http://localhost:8084/docs`.

### 4.1 Chủ đề

| Method | Path | Ai được gọi | Mô tả |
|---|---|---|---|
| GET | `/topics` | mọi vai trò | Chủ đề kèm số câu hỏi |
| POST | `/topics` | TEACHER, ADMIN | `{name, description}`, trả 201; tên trùng (không phân biệt hoa thường) thì 409 |
| PUT | `/topics/{id}` | người tạo, ADMIN | Sửa |
| DELETE | `/topics/{id}` | người tạo, ADMIN | Xóa, trả 204; còn câu hỏi thì 409 |

```json
{"id": 3, "name": "Thì quá khứ đơn", "description": "Past simple", "questionCount": 3,
 "createdBy": 3, "createdByName": "Trần Thị B", "createdAt": "2026-10-01T07:24:18.991318Z"}
```

`createdByName` do Learning Service hỏi Auth Service (`GET /users/lookup`); Auth Service lỗi thì là `null`, phần còn lại vẫn trả về.

### 4.2 Ngân hàng câu hỏi

Ngân hàng dùng chung cho mọi giảng viên. Mỗi câu có đúng 4 đáp án A, B, C, D và 1 đáp án đúng. Sinh viên không xem được ngân hàng (tránh lộ đáp án).

| Method | Path | Ai được gọi | Mô tả |
|---|---|---|---|
| GET | `/questions?topicId=&q=&mine=true` | TEACHER, ADMIN | Lọc theo chủ đề, từ khóa trong câu hỏi, câu của tôi |
| GET | `/questions/{id}` | TEACHER, ADMIN | Một câu |
| POST | `/questions` | TEACHER, ADMIN | Tạo câu, trả 201 |
| PUT | `/questions/{id}` | người soạn, ADMIN | Sửa |
| DELETE | `/questions/{id}` | người soạn, ADMIN | Xóa, trả 204 |
| GET | `/questions/import/template` | TEACHER, ADMIN | File Excel mẫu `mau-cau-hoi.xlsx` |
| POST | `/questions/import?topicId=&dryRun=true` | TEACHER, ADMIN | Nhập câu hỏi từ file `.xlsx` hoặc `.csv` |

Body khi tạo, sửa:

```json
{"topicId": 1, "content": "She ___ to school every day.", "optionA": "go", "optionB": "goes", "optionC": "gone",
 "optionD": "going", "correctOption": "B", "explanation": "Chủ ngữ số ít: động từ thêm -es."}
```

Một câu hỏi:

```json
{"id": 1, "topicId": 1, "topicName": "Thì hiện tại đơn", "content": "She ___ to school every day.",
 "optionA": "go", "optionB": "goes", "optionC": "gone", "optionD": "going", "correctOption": "B",
 "explanation": "Chủ ngữ số ít: động từ thêm -es.", "createdBy": 3, "createdByName": "Trần Thị B",
 "createdAt": "2026-10-01T07:20:37.556102Z", "updatedAt": "2026-10-01T08:08:26.052433Z"}
```

#### Nhập từ Excel hoặc CSV

Gửi `multipart/form-data` với trường `file`. Dòng 1 là tên cột, mỗi dòng sau là một câu: Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng, Giải thích. Tối đa 200 câu và 1 MB. CSV phải lưu dạng UTF-8.

- `dryRun=true`: chỉ kiểm tra, không lưu.
- `dryRun=false` (mặc định): lưu các dòng không có lỗi, bỏ qua các dòng còn lại.

```bash
curl -X POST "$G/questions/import?topicId=1&dryRun=true" -H "Authorization: Bearer $TOKEN" -F "file=@mau-cau-hoi.xlsx"
```

```json
{"topicId": 1, "topicName": "Thì hiện tại đơn", "dryRun": true, "total": 2, "valid": 1, "imported": 0,
 "rows": [{"row": 2, "content": "She ___ to school every day.", "optionA": "go", "optionB": "goes", "optionC": "gone",
           "optionD": "going", "correctOption": "B", "explanation": "…", "problems": ["duplicate"]},
          {"row": 3, "content": "They ___ football yesterday.", "optionA": "play", "optionB": "plays", "optionC": "played",
           "optionD": "playing", "correctOption": "C", "explanation": "…", "problems": []}]}
```

| Mã trong `problems` | Ý nghĩa |
|---|---|
| `content_missing` | Thiếu câu hỏi |
| `option_a_missing` … `option_d_missing` | Thiếu đáp án A … D |
| `correct_option_invalid` | Đáp án đúng không phải A, B, C, D |
| `too_long` | Nội dung quá dài (câu hỏi, giải thích 5000 ký tự; đáp án 1000) |
| `duplicate` | Trùng câu đã có trong chủ đề, hoặc trùng một dòng trước đó trong file |

Cả file không dùng được thì 400 với `message` là một trong: `"Only .xlsx and .csv files are supported"`, `"The file could not be read as an Excel workbook"`, `"The file has no questions"`, `"At most 200 questions per file"`, `"The file is larger than 1 MB"`, `"CSV files must be saved as UTF-8"`.

### 4.3 Luyện tập

Chỉ `STUDENT`. Câu hỏi lấy ngẫu nhiên từ ngân hàng (hoặc từ một chủ đề) và được sao chép vào lượt luyện tập lúc bắt đầu, nên giảng viên sửa ngân hàng sau đó không làm đổi lượt đang làm. Mỗi lượt nộp một lần.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/practice/limit` | Số câu tối đa mỗi lượt theo gói tài khoản |
| POST | `/practice/start` | Tạo lượt luyện tập |
| POST | `/practice/submit` | Nộp và chấm điểm |
| GET | `/practice/sessions` | 10 lượt gần nhất |
| GET | `/practice/sessions/{id}` | Một lượt của mình |

#### `GET /practice/limit`

Learning Service hỏi Auth Service gói tài khoản mỗi lần, nên admin chuyển sang VIP là có hiệu lực ngay. Auth Service không trả lời thì tạm tính FREE và `accountTypeChecked` là `false`.

```json
{"accountType": "FREE", "maxQuestions": 20, "accountTypeChecked": true}
```

#### `POST /practice/start`

```json
{"mode": "TOPIC", "topicId": 3, "questionCount": 10}
```

`mode` là `RANDOM` (không cần `topicId`) hoặc `TOPIC`. `questionCount` từ 1 đến 50 nhưng không quá giới hạn của gói: FREE 20, VIP 50 (vượt thì 403 `"FREE accounts can practise at most 20 questions per round"`). Ngân hàng có ít câu hơn thì lấy hết. Chủ đề không có câu nào thì 409. Trả 201 với câu hỏi chưa có đáp án:

```json
{"sessionId": 1, "mode": "TOPIC", "topicId": 3, "topicName": "Thì quá khứ đơn", "status": "IN_PROGRESS",
 "questionCount": 2, "correctCount": null, "score": null, "pointsEarned": null,
 "startedAt": "2026-10-01T08:38:51.635384Z", "submittedAt": null,
 "questions": [{"id": 4, "position": 1, "content": "Last summer we ___ to Quy Nhon beach.", "optionA": "go", "optionB": "goes",
                "optionC": "went", "optionD": "gone", "chosenOption": null, "correctOption": null, "explanation": null, "correct": null}]}
```

Ở đây `id` của câu là id trong ngân hàng.

#### `POST /practice/submit`

```json
{"sessionId": 1, "answers": [{"questionId": 4, "chosenOption": "C"}, {"questionId": 5, "chosenOption": "A"}]}
```

Câu không gửi đáp án tính là sai. Kết quả giống lượt luyện tập ở trên, có thêm đáp án, giải thích, điểm, điểm hoạt động nhận được, tổng điểm và streak:

```json
{"sessionId": 1, "status": "SUBMITTED", "questionCount": 2, "correctCount": 1, "score": 5.0, "pointsEarned": 11,
 "totalPoints": 11, "streak": {"currentStreak": 1, "longestStreak": 1, "lastActiveDate": "2026-10-01", "activeToday": true},
 "questions": ["…"]}
```

Nộp lần hai thì 409; lượt của người khác thì 403.

### 4.4 Sổ từ vựng

Chỉ `STUDENT`, mỗi sinh viên một sổ riêng. Từ của sinh viên khác trả 404.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/vocabularies?q=` | Sổ từ của mình, mới nhất trước; `q` tìm trong từ và nghĩa |
| POST | `/vocabularies` | Thêm `{word, meaning, example}`, trả 201; từ đã có (không phân biệt hoa thường) thì 409 |
| PUT | `/vocabularies/{id}` | Sửa |
| DELETE | `/vocabularies/{id}` | Xóa, trả 204 |

```json
{"id": 1, "word": "persevere", "meaning": "kiên trì", "example": "Persevere and you will succeed.",
 "createdAt": "2026-10-01T08:38:52.568305Z", "updatedAt": "2026-10-01T08:38:52.568305Z"}
```

### 4.5 Streak và điểm hoạt động

Một ngày (theo giờ Việt Nam) được tính vào chuỗi khi sinh viên nộp lượt luyện tập hoặc lưu từ mới. Chuỗi còn giữ nếu ngày học gần nhất là hôm nay hoặc hôm qua.

| Hoạt động | Điểm |
|---|---|
| Hoàn thành lượt luyện tập | +10 |
| Mỗi câu trả lời đúng | +1 |

`GET /streak` (chỉ `STUDENT`):

```json
{"currentStreak": 1, "longestStreak": 1, "lastActiveDate": "2026-10-01", "activeToday": true}
```

### 4.6 Bảng xếp hạng tuần

`GET /ranking/weekly?limit=10` (mọi vai trò, `limit` từ 0 đến 50). Điểm tính từ thứ Hai đến Chủ nhật theo giờ Việt Nam, cho toàn hệ thống. Bằng điểm thì cùng hạng (1, 2, 2, 4). Sinh viên có thêm `me`: hạng (`null` khi tuần này chưa có điểm), điểm tuần, tổng điểm và 10 lần nhận điểm gần nhất.

```json
{"weekStart": "2026-09-28", "weekEnd": "2026-10-04",
 "entries": [{"rank": 1, "studentId": 2, "fullName": "Nguyễn Văn A", "points": 25}],
 "me": {"rank": 1, "weekPoints": 25, "totalPoints": 25,
        "recent": [{"points": 14, "reason": "PRACTICE", "detail": "Thì quá khứ đơn", "createdAt": "2026-10-01T08:38:55.537060Z"},
                   {"points": 11, "reason": "PRACTICE", "detail": null, "createdAt": "2026-10-01T08:38:52.135051Z"}]}}
```

`detail` là tên chủ đề của lượt luyện tập (`null` khi luyện ngẫu nhiên). Họ tên trên bảng do Learning Service hỏi Auth Service.

---

## 5. Lời gọi giữa các service

Service không đọc database của nhau; cần dữ liệu thì gọi REST API của service sở hữu, luôn kèm token của người dùng đang gọi.

| Từ | Tới | Lời gọi | Để làm gì | Khi service kia lỗi |
|---|---|---|---|---|
| Gateway | Auth Service, Learning Service | xem mục 2 | Chuyển request, gộp dashboard | 502, hoặc `null` trên dashboard |
| Gateway | Auth Service | `GET /auth/session` | Phiên còn mở không; câu trả lời 204 được giữ 10 giây mỗi người dùng | Cho qua theo chữ ký |
| Gateway, Learning Service | Auth Service | `GET /.well-known/jwks.json` | Khóa công khai RS256; đọc một lần, đọc lại khi gặp `kid` mới | Dùng khóa đã có; chưa có khóa nào thì 502 |
| Learning Service | Auth Service | `GET /users/lookup` | Họ tên người soạn, người trên bảng xếp hạng | Vẫn trả dữ liệu, thiếu họ tên |
| Learning Service | Auth Service | `GET /users/{id}/account-type` | Giới hạn câu luyện tập FREE / VIP | Tạm tính FREE |

Learning Service (Python, FastAPI) và Auth Service (Java, Spring Boot) nói chuyện với nhau chỉ bằng HTTP và JSON: mỗi bên không cần biết bên kia viết bằng gì.

---

## 6. Ví dụ một phiên làm việc bằng curl

```bash
G=http://localhost:8000/api
TOKEN=$(curl -s -X POST $G/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"student1@nambede.local","password":"Student@123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')

curl -s $G/dashboard/student -H "Authorization: Bearer $TOKEN"     # gateway gộp dữ liệu Auth Service và Learning Service
curl -s -D - -o /dev/null $G/streak -H "Authorization: Bearer $TOKEN" | grep -i x-request-id  # mã để tìm trong log
curl -s $G/practice/limit -H "Authorization: Bearer $TOKEN"        # FREE: 20 câu, VIP: 50 câu
curl -s -X POST $G/practice/start -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"RANDOM","questionCount":5}'
curl -s "$G/ranking/weekly?limit=10" -H "Authorization: Bearer $TOKEN"
```

Kịch bản đầy đủ từ lúc tạo giảng viên, chủ đề, câu hỏi đến luyện tập có trong `README.md` ở thư mục gốc (mục "Kiểm tra nhanh bằng curl") và trong `docs/HUONG-DAN.md`.
