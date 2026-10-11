import { createContext, useContext } from "react"

import type { User } from "@/types"

export interface AuthContextValue {
  /** Signed-in user, or null */
  user: User | null
  /** True while a saved session is being restored */
  loading: boolean
  /** True after the user clicked "Đăng xuất": the next sign-in starts from the home page, not the last page */
  signedOut: boolean
  login: (email: string, password: string) => Promise<User>
  register: (fullName: string, email: string, password: string) => Promise<User>
  logout: () => void
  /** The signed-in user changes their own name; the new name shows everywhere at once. */
  updateProfile: (fullName: string) => Promise<User>
  /** The signed-in user changes their own password (the current one is checked by auth-service). */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}
