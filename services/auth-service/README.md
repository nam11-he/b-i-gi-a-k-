# Auth Service (Spring Boot)

Quản lý người dùng, đăng nhập, JWT, vai trò (`ADMIN` / `TEACHER` / `STUDENT`), trạng thái tài khoản (`ACTIVE` / `LOCKED`) và gói `FREE` / `VIP`.

- Cổng `8081`, database `auth_db` (bảng `users`, `outbox_events`, `signing_keys`). Schema do Flyway quản lý trong `src/main/resources/db/migration`.
- Swagger riêng: http://localhost:8081/swagger-ui.html (bản mô tả: `/v3/api-docs`, sinh bằng springdoc). Gọi qua gateway thì dùng Swagger chung ở http://localhost:8000/docs.
- Java 17, Spring Boot 4.1.1, Spring Security 7, JJWT 0.13. Token ký **RS256**. Cặp khóa RSA được tạo ở lần chạy đầu và lưu trong bảng `signing_keys` (không cần cấu hình); khóa công khai ở `GET /.well-known/jwks.json` cho gateway và các service khác. Chỉ service này ký được token.
- Token có claim `ver` = `token_version` của người dùng. Admin khóa tài khoản hoặc đổi vai trò thì `token_version` tăng, mọi token cũ thành phiên cũ; `GET /auth/session` trả 204 hoặc 401 kèm lý do, gateway hỏi API này (lưu đệm 10 giây).
- Tài khoản admin đầu tiên được tạo từ `ADMIN_EMAIL` / `ADMIN_PASSWORD` khi service khởi động.
- Mỗi request mang mã `X-Request-ID` từ gateway (không có thì tự tạo): mã được ghi trên mọi dòng log, trả lại trong header và ghi vào sự kiện `user.deleted`.
- Sinh viên tự đăng ký được. Giảng viên và admin do admin tạo.
- Admin xóa người dùng thì service phát sự kiện `user.deleted` (`userId`, `role`) qua bảng `outbox_events` và RabbitMQ, để Class Service và Learning Service dọn dữ liệu của người đó.
- Sai mật khẩu 5 lần trong 5 phút với cùng một email thì email đó bị chặn đăng nhập một lúc: 429 kèm `Retry-After`.
- Ai đăng nhập cũng tự đổi được họ tên và mật khẩu của mình. Đổi mật khẩu phải nhập đúng mật khẩu hiện tại (sai thì 403, không phải 401, để phiên đăng nhập không bị xóa). Email không đổi được; vai trò, trạng thái và gói tài khoản chỉ admin đổi.

## API

| Method | Path | Quyền |
|---|---|---|
| POST | `/auth/login` | công khai |
| POST | `/auth/register` | công khai, luôn tạo `STUDENT` |
| GET | `/auth/session` | header `Authorization`: 204 nếu phiên còn mở, 401 kèm lý do |
| GET | `/.well-known/jwks.json` | công khai: khóa công khai RS256 (JWK Set) |
| GET | `/users/me` | đã đăng nhập |
| PUT | `/users/me` `{fullName}`, `/users/me/password` `{currentPassword, newPassword}` | đã đăng nhập, chỉ cho chính mình |
| GET | `/users/{id}`, `/users/{id}/account-type` | đã đăng nhập (service khác gọi) |
| GET | `/users/lookup?ids=1,2,3` | đã đăng nhập (Class Service gọi để lấy họ tên) |
| GET | `/users?role=` | ADMIN |
| POST | `/users` | ADMIN |
| PUT | `/users/{id}` (họ tên), `/users/{id}/role`, `/users/{id}/status`, `/users/{id}/account-type` | ADMIN |
| DELETE | `/users/{id}` | ADMIN |

Lỗi luôn có dạng `{"status", "error", "message", "path"}`.

## Chạy và test

Từ thư mục gốc của repo:

```bash
docker compose up -d --build auth-service
```

Chạy test mà không cần cài Java trên máy (Maven chạy trong container, cache ở volume `nambede-m2`):

```bash
cd services/auth-service
docker run --rm -v "$PWD":/workspace -v nambede-m2:/root/.m2 -w /workspace \
  eclipse-temurin:17-jdk-noble ./mvnw -B -ntp verify
```
