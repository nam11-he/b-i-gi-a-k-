# API Gateway / BFF (FastAPI)

Điểm vào duy nhất cho client (web, Swagger, curl, script). Client không gọi trực tiếp các service phía sau.

- Cổng `8000`, không có database. Swagger chung của cả hệ thống: http://localhost:8000/docs (và `/api/docs`). `src/gateway/docs.py` lấy bản mô tả OpenAPI của từng service (`/v3/api-docs` với Spring, `/openapi.json` với FastAPI), chỉ giữ các đường dẫn gateway có định tuyến và đặt server là `/api`, nên mọi lần gọi thử đều đi qua gateway.
- Kiểm tra JWT (RS256, bằng khóa công khai đọc một lần từ `JWKS_URL` của Auth Service, `src/gateway/jwks.py`) rồi hỏi Auth Service phiên còn mở không (`GET /auth/session`, giữ câu trả lời 10 giây mỗi người dùng, `src/gateway/sessions.py`; Auth Service không trả lời thì cho qua theo chữ ký). Sau đó chuyển tiếp request tới service theo tiền tố đường dẫn. Header `Authorization`, query và body được chuyển nguyên vẹn. Không lấy được khóa công khai: 502, không phải 401.
- Phản hồi của service (kể cả lỗi) được trả về nguyên vẹn. Gateway chỉ tự sinh lỗi 400 (request tới API của chính gateway sai dạng), 401, 403, 404, 500 và **502 khi service không truy cập được**.
- Mỗi request có một mã `X-Request-ID` (giữ mã client gửi nếu đúng dạng, không thì tự tạo). Mã được chuyển sang service, trả lại trong header và ghi trên mọi dòng log (`src/gateway/requestid.py`), mỗi request một dòng log `METHOD path status thời gian`. Trình duyệt đọc được header này nhờ `expose_headers` của CORS.
- Response header được giữ lại theo danh sách cho phép: `Content-Disposition`, `Cache-Control`, `Location`, `Retry-After`.
- `GET /api/dashboard/student` là ví dụ BFF: một request từ client, gateway gọi song song Auth Service và Learning Service rồi gộp kết quả: hồ sơ (Auth), chuỗi ngày học, tổng điểm và hạng tuần (Learning). Learning Service không trả lời được thì các con số đó là `null`, hồ sơ vẫn hiển thị.

| Tiền tố công khai | Service | Cần token |
|---|---|---|
| `/api/auth/*` | auth-service | không |
| `/api/users/*` | auth-service | có |
| `/api/topics`, `/api/questions`, `/api/practice`, `/api/vocabularies`, `/api/streak`, `/api/ranking` | learning-service | có |
| `/api/dashboard/student` | gateway gộp dữ liệu (role STUDENT) | có |
| `/api/health` | gateway | không |
| `/docs`, `/api/docs`, `/api/openapi.json`, `/api/docs/<service>.json` | gateway: Swagger chung và các bản mô tả API | không |

Thêm service mới: thêm tiền tố vào bảng `ROUTES` trong `src/gateway/routes.py`, địa chỉ service vào `Settings` (`src/gateway/config.py`) và bản mô tả API vào `SPECS` (`src/gateway/docs.py`).

## Chạy và test

```bash
uv sync
uv run pytest
uv run uvicorn gateway.main:app --reload --port 8000   # đọc cấu hình từ ../../.env
```

Máy không có `uv`: `make test` ở thư mục gốc chạy pytest trong container. Trong Docker: `docker compose up -d --build gateway` từ thư mục gốc.
