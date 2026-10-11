import { ArrowLeft, SearchX } from "lucide-react"
import { Link } from "react-router"

import { Logo } from "@/components/common/Logo"
import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { homePath } from "@/lib/labels"
import { useDocumentTitle } from "@/lib/document-title"

export function NotFoundPage() {
  useDocumentTitle("Không tìm thấy trang")
  const { user } = useAuth()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-12 text-center">
      <Logo size={96} />
      <div className="space-y-2">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SearchX className="size-4" aria-hidden="true" />
          Lỗi 404
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Không tìm thấy trang này</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Đường dẫn bạn vừa mở không tồn tại hoặc đã được thay đổi. Hãy quay lại và chọn trang từ trình đơn chính.
        </p>
      </div>
      <Link to={user ? homePath(user.role) : "/login"} className={buttonVariants({ size: "lg" })}>
        <ArrowLeft aria-hidden="true" />
        {user ? "Về trang chủ" : "Về trang đăng nhập"}
      </Link>
    </div>
  )
}
