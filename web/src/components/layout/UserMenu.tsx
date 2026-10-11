import { ChevronsUpDown, LogOut, UserRound } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/lib/auth"
import { ACCOUNT_TYPE_META, ROLE_META } from "@/lib/labels"

/** Account menu in the top right: who is signed in, own account page, sign out. */
export function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const signOut = () => {
    logout()
    toast.success("Đã đăng xuất")
    navigate("/login", { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2 px-1.5" aria-label="Trình đơn tài khoản" />}>
        <UserAvatar name={user.fullName} size="sm" />
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="max-w-40 truncate text-sm font-medium">{user.fullName}</span>
          <span className="text-xs font-normal text-muted-foreground">{ROLE_META[user.role].label}</span>
        </span>
        <ChevronsUpDown className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-foreground">
            <span className="flex flex-col gap-1.5 py-0.5">
              <span className="truncate text-sm font-medium">{user.fullName}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
              <span className="flex gap-1.5">
                <StatusBadge meta={ROLE_META[user.role]} className="font-normal" />
                {user.role === "STUDENT" ? <StatusBadge meta={ACCOUNT_TYPE_META[user.accountType]} className="font-normal" /> : null}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserRound aria-hidden="true" />
          Tài khoản của tôi
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut aria-hidden="true" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
