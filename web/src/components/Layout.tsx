import { AppShell } from "@/components/layout/AppShell"
import { PortalShell } from "@/components/layout/PortalShell"
import { useAuth } from "@/lib/auth"

/** Admins get the sidebar shell, lecturers and students the top-bar shell (same split as the rental project). */
export function Layout() {
  const { user } = useAuth()
  if (!user) return null
  return user.role === "ADMIN" ? <AppShell /> : <PortalShell />
}
