import { BookA, BookOpenCheck, Dumbbell, LayoutDashboard, Trophy, Users, type LucideIcon } from "lucide-react"

import type { Role } from "@/types"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Roles that see the link in the top bar; every role when absent. */
  roles?: Role[]
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export interface Crumb {
  label: string
  to?: string
}

/** Admin sidebar, grouped. */
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  { label: "Tổng quan", items: [{ to: "/dashboard", label: "Bảng điều khiển", icon: LayoutDashboard }] },
  {
    label: "Quản lý",
    items: [{ to: "/users", label: "Người dùng", icon: Users }],
  },
  {
    label: "Học tập",
    items: [
      { to: "/questions", label: "Ngân hàng câu hỏi", icon: BookOpenCheck },
      { to: "/ranking", label: "Xếp hạng", icon: Trophy },
    ],
  },
]

/** Top navigation for lecturers and students. */
export const PORTAL_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/practice", label: "Luyện tập", icon: Dumbbell, roles: ["STUDENT"] },
  { to: "/vocabulary", label: "Từ vựng", icon: BookA, roles: ["STUDENT"] },
  { to: "/questions", label: "Ngân hàng câu hỏi", icon: BookOpenCheck, roles: ["TEACHER"] },
  { to: "/ranking", label: "Xếp hạng", icon: Trophy },
]

/** /practice/4 still highlights "Luyện tập". */
export function isNavItemActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`)
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Bảng điều khiển",
  users: "Người dùng",
  questions: "Ngân hàng câu hỏi",
  practice: "Luyện tập",
  vocabulary: "Từ vựng",
  ranking: "Xếp hạng",
  profile: "Tài khoản của tôi",
}

/** Breadcrumb for the admin header, e.g. /questions gives "Bảng điều khiển / Ngân hàng câu hỏi". */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean)
  const root: Crumb = { label: "Bảng điều khiển", to: "/dashboard" }
  const rest = segments[0] === "dashboard" ? segments.slice(1) : segments
  if (rest.length === 0) return [{ label: root.label }]

  const crumbs: Crumb[] = [root]
  let prefix = ""
  rest.forEach((segment, index) => {
    prefix = `${prefix}/${segment}`
    const label = /^\d+$/.test(segment) ? "Chi tiết" : (SEGMENT_LABELS[segment] ?? segment)
    crumbs.push({ label, to: index === rest.length - 1 ? undefined : prefix })
  })
  return crumbs
}
