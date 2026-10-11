import { LoaderCircle } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, Navigate } from "react-router"
import { toast } from "sonner"

import { AuthShell } from "@/components/AuthShell"
import { PasswordInput } from "@/components/PasswordInput"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { errorText } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { homePath } from "@/lib/labels"
import { useDocumentTitle } from "@/lib/document-title"

const FIELD = "h-12 rounded-xl px-4 text-base md:text-base"

/** Public sign-up creates a STUDENT account. Lecturers are created by an admin. */
export function RegisterPage() {
  useDocumentTitle("Đăng ký")
  const { user, register } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={homePath(user.role)} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      const created = await register(String(form.get("fullName")).trim(), String(form.get("email")).trim(), String(form.get("password")))
      toast.success(`Chào mừng ${created.fullName} đến với NamBeDe`)
    } catch (err) {
      setError(errorText(err, { 409: "Email này đã được đăng ký." }))
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Đăng ký" description="Dành cho sinh viên. Tài khoản giảng viên do quản trị viên cấp.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName" className="sr-only">
            Họ và tên
          </Label>
          <Input id="fullName" name="fullName" placeholder="Họ và tên" autoComplete="name" required autoFocus disabled={submitting} className={FIELD} />
        </div>
        <div>
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input id="email" name="email" type="email" placeholder="Email" autoComplete="email" required disabled={submitting} className={FIELD} />
        </div>
        <div>
          <Label htmlFor="password" className="sr-only">
            Mật khẩu
          </Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Mật khẩu (ít nhất 6 ký tự)"
            autoComplete="new-password"
            minLength={6}
            required
            disabled={submitting}
            className={FIELD}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-xl bg-[#0066CA] text-base font-bold text-white hover:bg-[#0056AD] focus-visible:ring-[#0066CA]/50"
        >
          {submitting ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
          {submitting ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản?{" "}
          <Link to="/login" className="font-medium text-[#0066CA] hover:underline dark:text-sky-400">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
