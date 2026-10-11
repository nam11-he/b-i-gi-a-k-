import type { AccountType, Role, UserStatus } from "@/types"

/** Vietnamese label and badge colours (with dark-mode variants) for one enum value. */
export interface EnumMeta {
  label: string
  badge: string
}

/** One palette for every badge in the app (same convention as the rental project). */
export const TONE = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
} as const

export const ROLES: Role[] = ["STUDENT", "TEACHER", "ADMIN"]

export const ROLE_META: Record<Role, EnumMeta> = {
  ADMIN: { label: "Quản trị viên", badge: TONE.violet },
  TEACHER: { label: "Giảng viên", badge: TONE.blue },
  STUDENT: { label: "Sinh viên", badge: TONE.teal },
}

export const STATUS_META: Record<UserStatus, EnumMeta> = {
  ACTIVE: { label: "Đang hoạt động", badge: TONE.emerald },
  LOCKED: { label: "Đã khóa", badge: TONE.rose },
}

export const ACCOUNT_TYPE_META: Record<AccountType, EnumMeta> = {
  FREE: { label: "FREE", badge: TONE.slate },
  VIP: { label: "VIP", badge: TONE.amber },
}

/** Page a user lands on after signing in (every role starts on its dashboard). */
export function homePath(_role: Role): string {
  return "/dashboard"
}
