# Learning Service (FastAPI)

Chủ đề, ngân hàng câu hỏi, luyện tập, từ vựng, streak, điểm hoạt động và bảng xếp hạng.

- Cổng `8084`, database `learning_db` (bảng `topics`, `questions`, `practice_sessions`, `practice_answers`, `vocabularies`, `student_streak`, `student_points`). Schema do Alembic quản lý trong `alembic/versions`, chạy tự động khi container khởi động.
- Swagger riêng: http://localhost:8084/docs (bản mô tả: `/openapi.json`). Gọi qua gateway thì dùng Swagger chung ở http://localhost:8000/docs.
- Ngân hàng câu hỏi dùng chung cho mọi giảng viên: câu trắc nghiệm 4 đáp án A đến D, 1 đáp án đúng. Chỉ người soạn hoặc admin được sửa, xóa. Sinh viên không xem được ngân hàng (tránh lộ đáp án) nhưng xem được danh sách chủ đề.
- Luyện tập: mỗi lần bắt đầu, service hỏi Auth Service `GET /users/{id}/account-type`. Tài khoản FREE luyện tối đa 20 câu mỗi lượt, VIP tối đa 50 câu. Auth Service không trả lời thì tạm tính là FREE. Câu hỏi được lấy ngẫu nhiên và sao chép vào lượt luyện tập, nên sửa ngân hàng sau đó không làm đổi lượt đang làm.
- Điểm hoạt động: hoàn thành lượt luyện tập +10, mỗi câu đúng +1. Mỗi lượt chỉ được tính điểm một lần (`source_key` duy nhất, ví dụ `PRACTICE:12`).
- Streak: ngày nào sinh viên nộp lượt luyện tập hoặc lưu từ mới thì ngày đó được tính. Ngày và tuần theo giờ Việt Nam (`APP_TIMEZONE`, mặc định `Asia/Ho_Chi_Minh`). Bảng xếp hạng tuần tính từ thứ Hai đến Chủ nhật, cùng điểm thì cùng hạng.
- Nhập câu hỏi từ file `.xlsx` hoặc `.csv` theo file mẫu (Câu hỏi, Đáp án A đến D, Đáp án đúng, Giải thích), tối đa 200 câu và 1 MB. Mỗi dòng được kiểm tra riêng và trả về mã lỗi (`content_missing`, `option_b_missing`, `correct_option_invalid`, `too_long`, `duplicate`). Xem trước với `dryRun=true`, nhập thật thì chỉ lưu các dòng không có lỗi và không trùng câu đã có trong chủ đề.
- Họ tên lấy từ Auth Service qua `GET /users/lookup`, kèm token của người gọi. Nếu Auth Service lỗi, dữ liệu vẫn trả về, chỉ thiếu tên.
- Token được kiểm tra bằng khóa công khai của Auth Service (RS256, `JWKS_URL`, đọc một lần rồi giữ trong bộ nhớ); service không giữ bí mật nào nên không tự tạo được token. Chưa lấy được khóa: 502.
- Mỗi request mang mã `X-Request-ID` từ gateway (không có thì tự tạo): mã được ghi trên mọi dòng log, trả lại trong header, chuyển tiếp khi gọi service khác.
- `GET /health` trả 503 khi không kết nối được database.

## API

| Method | Path | Ai được gọi | Mô tả |
|---|---|---|---|
| GET | `/topics` | mọi vai trò | Chủ đề kèm số câu hỏi |
| POST | `/topics` | giảng viên, admin | Tạo chủ đề `{name, description}`; tên không trùng |
| PUT, DELETE | `/topics/{id}` | người tạo, admin | Sửa, xóa; không xóa được khi còn câu hỏi (409) |
| GET | `/questions?topicId=&q=&mine=true` | giảng viên, admin | Lọc theo chủ đề, từ khóa, câu của tôi |
| GET | `/questions/{id}` | giảng viên, admin | Một câu hỏi |
| POST | `/questions` | giảng viên, admin | `{topicId, content, optionA..optionD, correctOption, explanation}` |
| PUT, DELETE | `/questions/{id}` | người soạn, admin | Sửa, xóa |
| GET | `/questions/import/template` | giảng viên, admin | File Excel mẫu `mau-cau-hoi.xlsx` |
| POST | `/questions/import?topicId=&dryRun=true` | giảng viên, admin | Gửi file (multipart, trường `file`): xem trước từng dòng, hoặc nhập khi `dryRun=false` |
| GET | `/practice/limit` | sinh viên | `{accountType, maxQuestions, accountTypeChecked}` |
| POST | `/practice/start` | sinh viên | `{mode: RANDOM \| TOPIC, topicId, questionCount}`: tạo lượt, trả câu hỏi chưa có đáp án |
| POST | `/practice/submit` | sinh viên | `{sessionId, answers: [{questionId, chosenOption}]}`: chấm điểm thang 10, cộng điểm, cập nhật streak, trả đáp án và giải thích |
| GET | `/practice/sessions`, `/practice/sessions/{id}` | sinh viên | 10 lượt gần nhất, một lượt của mình |
| GET, POST | `/vocabularies` | sinh viên | Sổ từ riêng: danh sách, thêm `{word, meaning, example}` (không trùng từ) |
| PUT, DELETE | `/vocabularies/{id}` | chủ sổ | Sửa, xóa |
| GET | `/streak` | sinh viên | `{currentStreak, longestStreak, lastActiveDate, activeToday}` |
| GET | `/ranking/weekly?limit=10` | mọi vai trò | Top tuần này; sinh viên có thêm `me`: hạng, điểm tuần, tổng điểm, điểm gần đây |

## Chạy và test

```bash
uv sync
uv run pytest
uv run alembic upgrade head                                 # cần Postgres của docker compose đang chạy
uv run uvicorn learning_service.main:app --reload --port 8084
```

Thêm bảng mới: khai báo model trong `src/learning_service/models.py`, rồi chạy `uv run alembic revision --autogenerate -m "mo ta"`, kiểm tra file sinh ra, và `uv run alembic check` để chắc model khớp database. Test dùng SQLite trong bộ nhớ và đồng hồ giả (`clock.now`), nên không cần Postgres và kiểm tra được streak qua nhiều ngày.

Máy không có `uv`: `make test` ở thư mục gốc chạy pytest trong container. Trong Docker: `docker compose up -d --build learning-service` từ thư mục gốc.
