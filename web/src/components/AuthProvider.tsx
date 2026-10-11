import { useEffect, useState, type ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router"

import { api, onUnauthorized, tokenStore } from "@/lib/api"
import { LoadingState } from "@/components/common/LoadingState"
import { AuthContext, useAuth } from "@/lib/auth"
import { homePath } from "@/lib/labels"
import type { LoginResponse, Role, User } from "@/types"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(() => tokenStore.get() !== null)
  const [signedOut, setSignedOut] = useState(false)

  // A request was rejected with 401 while signed in: the token expired, so sign out
  useEffect(() => {
    onUnauthorized(() => setUser(null))
    return () => onUnauthorized(null)
  }, [])

  // Restore the session from the saved token
  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    api<User>("/users/me")
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function startSession(request: Promise<LoginResponse>): Promise<User> {
    const response = await request
    tokenStore.set(response.accessToken)
    setSignedOut(false)
    setUser(response.user)
    return response.user
  }

  const value = {
    user,
    loading,
    signedOut,
    login: (email: string, password: string) =>
      startSession(api<LoginResponse>("/auth/login", { method: "POST", body: { email, password }, auth: false })),
    register: (fullName: string, email: string, password: string) =>
      startSession(
        api<LoginResponse>("/auth/register", { method: "POST", body: { fullName, email, password }, auth: false })
      ),
    logout: () => {
      tokenStore.clear()
      setSignedOut(true)
      setUser(null)
    },
    updateProfile: async (fullName: string) => {
      const updated = await api<User>("/users/me", { method: "PUT", body: { fullName } })
      setUser(updated)
      return updated
    },
    changePassword: (currentPassword: string, newPassword: string) =>
      api<void>("/users/me/password", { method: "PUT", body: { currentPassword, newPassword } }),
  }

  return <AuthContext value={value}>{children}</AuthContext>
}

/** Route guard: requires a signed-in user and, if `roles` is given, one of those roles. */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading, signedOut } = useAuth()
  const location = useLocation()

  if (loading) return <SessionLoading />
  if (!user) {
    // Remember the page only when the session ended on its own (expired token), not after "Đăng xuất"
    return <Navigate to="/login" replace state={signedOut ? undefined : { from: location.pathname }} />
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}

/** "/" and unknown paths: the signed-in user's home page, otherwise the login page. */
export function HomeRedirect() {
  const { user, loading } = useAuth()

  if (loading) return <SessionLoading />
  return <Navigate to={user ? homePath(user.role) : "/login"} replace />
}

/** Skeleton while the saved session is being restored. */
function SessionLoading() {
  return (
    <div className="min-h-svh bg-background p-6">
      <LoadingState cards={4} rows={5} />
    </div>
  )
}
