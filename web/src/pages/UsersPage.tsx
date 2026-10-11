import { Crown, Lock, LockOpen, MoreHorizontal, Plus, Search, Trash2, Users } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { DataTable, type Column } from "@/components/common/DataTable"
import { ErrorState } from "@/components/common/ErrorState"
import { FormDialogShell } from "@/components/common/FormDialogShell"
import { PageHeader } from "@/components/common/PageHeader"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { api, errorText } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { ACCOUNT_TYPE_META, ROLE_META, ROLES, STATUS_META } from "@/lib/labels"
import type { Role, User } from "@/types"

/** ADMIN only: every account, create lecturer / admin accounts, lock, switch FREE / VIP, delete. */
export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "">("")
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api<User[]>("/users")
      .then((result) => {
        if (cancelled) return
        setUsers(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const reload = () => setVersion((value) => value + 1)
  const query = search.trim().toLowerCase()
  const visible = users.filter(
    (item) =>
      (!roleFilter || item.role === roleFilter) &&
      (!query || item.fullName.toLowerCase().includes(query) || item.email.toLowerCase().includes(query))
  )

  async function update(target: User, action: "status" | "account-type", body: object, success: string) {
    try {
      const updated = await api<User>(`/users/${target.id}/${action}`, { method: "PUT", body })
      setUsers((list) => list.map((item) => (item.id === updated.id ? updated : item)))
      toast.success(success)
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api<void>(`/users/${deleteTarget.id}`, { method: "DELETE" })
      setUsers((list) => list.filter((item) => item.id !== deleteTarget.id))
      toast.success(`Đã xóa tài khoản ${deleteTarget.email}`)
      setDeleteTarget(null)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setDeleting(false)
    }
  }

  const columns: Column<User>[] = [
    {
      key: "user",
      header: "Người dùng",
      mobile: "title",
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={row.fullName} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.fullName}
              {row.id === currentUser?.id ? <span className="font-normal text-muted-foreground"> (bạn)</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    { key: "role", header: "Vai trò", mobile: "trailing", cell: (row) => <StatusBadge meta={ROLE_META[row.role]} /> },
    { key: "status", header: "Trạng thái", cell: (row) => <StatusBadge meta={STATUS_META[row.status]} /> },
    { key: "plan", header: "Gói", cell: (row) => <StatusBadge meta={ACCOUNT_TYPE_META[row.accountType]} /> },
    { key: "created", header: "Ngày tạo", cell: (row) => <span className="text-muted-foreground tabular-nums">{formatDate(row.createdAt)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "trailing",
      cell: (row) => {
        const isSelf = row.id === currentUser?.id
        return (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${row.fullName}`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {row.role === "STUDENT" ? (
                <DropdownMenuItem
                  onClick={() =>
                    update(
                      row,
                      "account-type",
                      { accountType: row.accountType === "VIP" ? "FREE" : "VIP" },
                      row.accountType === "VIP" ? `${row.fullName} đã về gói FREE` : `${row.fullName} đã lên gói VIP`
                    )
                  }
                >
                  <Crown />
                  {row.accountType === "VIP" ? "Chuyển về FREE" : "Nâng lên VIP"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                disabled={isSelf}
                onClick={() =>
                  update(
                    row,
                    "status",
                    { status: row.status === "ACTIVE" ? "LOCKED" : "ACTIVE" },
                    row.status === "ACTIVE" ? `Đã khóa tài khoản ${row.email}` : `Đã mở khóa tài khoản ${row.email}`
                  )
                }
              >
                {row.status === "ACTIVE" ? <Lock /> : <LockOpen />}
                {row.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" disabled={isSelf} onClick={() => setDeleteTarget(row)}>
                <Trash2 />
                Xóa tài khoản
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Người dùng"
        description="Sinh viên tự đăng ký tài khoản. Tài khoản giảng viên và quản trị viên được tạo tại đây."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Tạo tài khoản
          </Button>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
        <InputGroup className="sm:max-w-sm">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Tìm theo họ tên hoặc email…" value={search} onChange={(event) => setSearch(event.target.value)} />
        </InputGroup>
        <NativeSelect aria-label="Lọc theo vai trò" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as Role | "")} className="sm:w-48">
          <NativeSelectOption value="">Tất cả vai trò</NativeSelectOption>
          {ROLES.map((role) => (
            <NativeSelectOption key={role} value={role}>
              {ROLE_META[role].label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground sm:ml-auto">{loading ? "Đang tải…" : `${visible.length} / ${users.length} người dùng`}</p>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <DataTable
          columns={columns}
          data={visible}
          rowKey={(row) => row.id}
          isLoading={loading}
          emptyTitle={users.length === 0 ? "Chưa có người dùng" : "Không có người dùng khớp bộ lọc"}
          emptyDescription={users.length === 0 ? undefined : "Thử đổi từ khóa tìm kiếm hoặc vai trò."}
        />
      )}

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          setUsers((list) => [...list, created])
          toast.success(`Đã tạo tài khoản ${ROLE_META[created.role].label.toLowerCase()} ${created.email}`)
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Xóa tài khoản này?"
        description={deleteTarget ? `${deleteTarget.fullName} (${deleteTarget.email}) sẽ không đăng nhập được nữa. Thao tác này không hoàn tác được.` : undefined}
        confirmLabel="Xóa tài khoản"
        variant="destructive"
        isPending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (user: User) => void }) {
  const [role, setRole] = useState<Role>("TEACHER")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      const created = await api<User>("/users", {
        method: "POST",
        body: {
          fullName: String(form.get("fullName")).trim(),
          email: String(form.get("email")).trim(),
          password: String(form.get("password")),
          role,
        },
      })
      onCreated(created)
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err, { 409: "Email này đã được đăng ký." }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(next) => {
        if (next) setError(null)
        onOpenChange(next)
      }}
      title="Tạo tài khoản"
      description="Người dùng đăng nhập bằng email và mật khẩu này."
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitLabel="Tạo tài khoản"
      error={error}
    >
      <div className="grid gap-2">
        <Label htmlFor="new-fullName">Họ và tên</Label>
        <Input id="new-fullName" name="fullName" required maxLength={255} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-email">Email</Label>
        <Input id="new-email" name="email" type="email" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="new-password">Mật khẩu</Label>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={6} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="new-role">Vai trò</Label>
          <NativeSelect id="new-role" value={role} onChange={(event) => setRole(event.target.value as Role)} className="w-full">
            {ROLES.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {ROLE_META[option].label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5" />
        Sinh viên thường tự đăng ký ở trang đăng ký.
      </p>
    </FormDialogShell>
  )
}
