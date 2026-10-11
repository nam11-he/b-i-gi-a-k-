import { CalendarDays, KeyRound, LoaderCircle, Mail, Save, UserRound } from "lucide-react"
import { useState, type FormEvent } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/PageHeader"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { PasswordInput } from "@/components/PasswordInput"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError, errorText } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { ACCOUNT_TYPE_META, ROLE_META } from "@/lib/labels"

/** /profile for every role: own details, change the name and the password. Email, role and plan stay with admins. */
export function ProfilePage() {
  const { user, updateProfile, changePassword } = useAuth()
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  if (!user) return null

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fullName = String(new FormData(event.currentTarget).get("fullName")).trim()
    if (!fullName) {
      setNameError("Nhập họ và tên.")
      return
    }
    setSavingName(true)
    setNameError(null)
    try {
      await updateProfile(fullName)
      toast.success("Đã lưu họ và tên")
    } catch (err) {
      setNameError(errorText(err))
    } finally {
      setSavingName(false)
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const current = String(data.get("currentPassword"))
    const next = String(data.get("newPassword"))
    const confirm = String(data.get("confirmPassword"))
    let problem: string | null = null
    if (!current) problem = "Nhập mật khẩu hiện tại."
    else if (next.length < 6) problem = "Mật khẩu mới phải có ít nhất 6 ký tự."
    else if (next !== confirm) problem = "Nhập lại mật khẩu mới chưa khớp."
    else if (next === current) problem = "Mật khẩu mới phải khác mật khẩu hiện tại."
    if (problem) {
      setPasswordError(problem)
      return
    }
    setSavingPassword(true)
    setPasswordError(null)
    try {
      await changePassword(current, next)
      form.reset()
      toast.success("Đã đổi mật khẩu", { description: "Lần đăng nhập sau dùng mật khẩu mới." })
    } catch (err) {
      setPasswordError(
        err instanceof ApiError && err.status === 400 && /different/i.test(err.message)
          ? "Mật khẩu mới phải khác mật khẩu hiện tại."
          : errorText(err, { 403: "Mật khẩu hiện tại không đúng." })
      )
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Tài khoản của tôi" description="Thông tin đăng nhập của bạn trong hệ thống NamBeDe." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" aria-hidden />
              Thông tin cá nhân
            </CardTitle>
            <CardDescription>Email, vai trò và gói tài khoản do quản trị viên quản lý.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <UserAvatar name={user.fullName} size="lg" />
              <div className="min-w-0 space-y-1.5">
                <p className="truncate font-heading text-lg font-semibold">{user.fullName}</p>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge meta={ROLE_META[user.role]} />
                  {user.role === "STUDENT" ? <StatusBadge meta={ACCOUNT_TYPE_META[user.accountType]} /> : null}
                </div>
              </div>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Email</dt>
                <dd className="min-w-0 truncate">{user.email}</dd>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Ngày tạo tài khoản</dt>
                <dd>Tham gia ngày {formatDate(user.createdAt)}</dd>
              </div>
            </dl>
            <form onSubmit={saveName} className="space-y-3" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="profile-name">Họ và tên</Label>
                {/* key: the field follows the saved name */}
                <Input key={user.fullName} id="profile-name" name="fullName" defaultValue={user.fullName} maxLength={255} autoComplete="name" required />
              </div>
              {nameError ? (
                <p role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              ) : null}
              <Button type="submit" disabled={savingName}>
                {savingName ? <LoaderCircle className="animate-spin" /> : <Save />}
                Lưu họ và tên
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" aria-hidden />
              Đổi mật khẩu
            </CardTitle>
            <CardDescription>Mật khẩu mới có ít nhất 6 ký tự. Phiên đăng nhập hiện tại vẫn giữ nguyên.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePassword} className="space-y-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                <PasswordInput id="current-password" name="currentPassword" autoComplete="current-password" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">Mật khẩu mới</Label>
                <PasswordInput id="new-password" name="newPassword" autoComplete="new-password" minLength={6} maxLength={72} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Nhập lại mật khẩu mới</Label>
                <PasswordInput id="confirm-password" name="confirmPassword" autoComplete="new-password" maxLength={72} required />
              </div>
              {passwordError ? (
                <p role="alert" className="text-sm text-destructive">
                  {passwordError}
                </p>
              ) : null}
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
                Đổi mật khẩu
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
