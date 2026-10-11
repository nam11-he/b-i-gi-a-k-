import { LoaderCircle } from "lucide-react"
import { useState, type FormEvent } from "react"
import { Link, Navigate, useLocation } from "react-router"
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

export function LoginPage() {
  useDocumentTitle("Đăng nhập")
  const { user, login } = useAuth()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? homePath(user.role)} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      const signedIn = await login(String(form.get("email")).trim(), String(form.get("password")))
      toast.success(`Xin chào ${signedIn.fullName}`)
    } catch (err) {
      setError(
        errorText(err, {
          401: "Email hoặc mật khẩu không đúng.",
          403: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
        })
      )
      setSubmitting(false)
    }
  }

  return (
    <AuthShell title="Đăng nhập" description="Dành cho sinh viên, giảng viên và quản trị viên.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input id="email" name="email" type="email" placeholder="Email" autoComplete="email" required autoFocus disabled={submitting} className={FIELD} />
        </div>
        <div>
          <Label htmlFor="password" className="sr-only">
            Mật khẩu
          </Label>
          <PasswordInput id="password" name="password" placeholder="Mật khẩu" autoComplete="current-password" required disabled={submitting} className={FIELD} />
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
          {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Sinh viên chưa có tài khoản?{" "}
          <Link to="/register" className="font-medium text-[#0066CA] hover:underline dark:text-sky-400">
            Đăng ký
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
