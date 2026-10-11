Môn bà Mỹ

# Web (React + Vite)

Giao diện web của NamBeDe. Chỉ gọi **API Gateway** qua đường dẫn `/api` cùng domain, không gọi trực tiếp service nào.

- React 19, Vite 8, TypeScript, Tailwind CSS 4, shadcn/ui (style `base-nova`), React Router 8.
- Bản giữa kỳ chỉ có các trang dùng Auth Service và Learning Service:
  - Đăng nhập, sinh viên tự đăng ký; trang Tài khoản của tôi cho mọi vai trò (đổi họ tên, đổi mật khẩu).
  - Admin: sidebar bên trái, bảng điều khiển (người dùng, câu hỏi, xếp hạng tuần), trang Người dùng (tạo tài khoản, khóa / mở khóa, chuyển FREE / VIP, xóa).
  - Giảng viên và admin: Ngân hàng câu hỏi (chủ đề, câu trắc nghiệm 4 đáp án, lọc, tìm kiếm, nhập từ Excel hoặc CSV: tải file mẫu, xem trước từng dòng, nhập các dòng hợp lệ).
  - Sinh viên: tổng quan (chuỗi ngày học, điểm, hạng tuần từ một lần gọi `/api/dashboard/student`), luyện tập ngẫu nhiên hoặc theo chủ đề (FREE tối đa 20 câu mỗi lượt, VIP 50 câu), xem điểm, giải thích, điểm hoạt động ngay sau khi nộp; sổ từ vựng riêng có chế độ che nghĩa.
  - Mọi vai trò: bảng xếp hạng tuần; chế độ sáng / tối; tab trình duyệt hiện tên trang; các trang sau đăng nhập chỉ tải khi mở.

## Chạy

**Trong Docker** (cùng toàn bộ hệ thống, từ thư mục gốc): `make up` hoặc `docker compose up -d --build --wait`, rồi mở http://nambede.dev.localhost. Container nginx phục vụ bản build và chuyển `/api` tới gateway (xem `nginx.conf`).

**Khi phát triển giao diện** (hot reload): giữ các service chạy bằng Docker, rồi

```bash
cd web
npm install
npm run dev      # http://localhost:5173, Vite chuyển /api tới gateway ở localhost:8000
npm test         # unit test (Vitest)
npm run build    # kiểm tra kiểu và build
npm run lint
```

## Cấu trúc `src/`

| Đường dẫn | Vai trò |
|---|---|
| `lib/api.ts` | Gọi gateway, gắn JWT, chuyển lỗi thành câu tiếng Việt (`errorText`); `upload` gửi file, `download` tải file |
| `lib/document-title.ts` | Tên trang trên tab trình duyệt, `PageHeader` tự đặt |
| `lib/auth.ts`, `components/AuthProvider.tsx` | Phiên đăng nhập, `useAuth()`, chặn route theo vai trò (`RequireAuth`) |
| `lib/labels.ts` | Nhãn tiếng Việt và màu badge cho vai trò, trạng thái, gói tài khoản |
| `lib/questions.ts`, `lib/practice.ts` | Gọi API ngân hàng câu hỏi, luyện tập, từ vựng, streak, xếp hạng (Learning Service) |
| `lib/format.ts` | Định dạng ngày giờ, số, điểm thang 10 và màu của điểm |
| `lib/theme.ts`, `components/layout/ThemeProvider.tsx` | Chế độ sáng / tối / theo hệ thống |
| `components/layout/` | Admin: `AppShell` (thanh bên thu gọn được, header có breadcrumb). Giảng viên, sinh viên: `PortalShell` (thanh trên cùng). `UserMenu`, `ThemeToggle` |
| `components/common/` | `Logo`, `BrandMark`, `PageHeader`, `StatCard`, `StatusBadge`, `DataTable`, `EmptyState`, `ErrorState`, `LoadingState`, `ConfirmDialog`, `FormDialogShell`, `UserAvatar` |
| `components/QuestionImportDialog.tsx`, `components/VocabularyFormDialog.tsx` | Hộp thoại nhập câu hỏi từ Excel, thêm / sửa từ vựng |
| `components/AnswerOptions.tsx`, `components/SubmissionReview.tsx` | 4 đáp án của một câu (chọn, xem lại, đáp án đúng) và phần điểm, đáp án, giải thích sau khi nộp lượt luyện tập |
| `pages/` | `LoginPage`, `RegisterPage`, `DashboardPage` (theo vai trò), `UsersPage`, `QuestionBankPage`, `PracticePage`, `PracticeSessionPage`, `VocabularyPage`, `RankingPage`, `ProfilePage`, `NotFoundPage`. Các trang sau đăng nhập được tải khi mở (`lazy` trong `App.tsx`) |
| `components/ui/` | Component shadcn (style `base-nova`), thêm bằng `npx shadcn add ...` |

## Giao diện

Thiết kế theo frontend của dự án `rental-room-management`:

- Huy hiệu Trường Đại học Quy Nhơn ở `public/logo.svg`, chỉ dùng qua `Logo` và `BrandMark`. Dùng nguyên trạng: không đổi màu, không bóp méo. Dưới 48px luôn đi kèm chữ, đứng một mình chỉ từ 96px (trang đăng nhập, 404).
- Màu nhận diện `#0066CA` chỉ dùng ở trang đăng nhập và đăng ký; phần còn lại giữ bảng màu shadcn.
- Thông báo dùng toast (`sonner`); xóa, nộp bài dùng `ConfirmDialog`; tạo, sửa dùng `FormDialogShell`.
- Bảng dùng `DataTable`: trên điện thoại mỗi dòng thành một thẻ.
