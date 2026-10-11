import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { RequireAuth } from "@/components/AuthProvider"
import { AuthContext, type AuthContextValue } from "@/lib/auth"
import type { Role, User } from "@/types"

function userWith(role: Role): User {
  return {
    id: 2,
    email: "user2@nambede.local",
    fullName: "Nguyễn Văn A",
    role,
    status: "ACTIVE",
    accountType: "FREE",
    createdAt: "2026-10-01T00:00:00Z",
  }
}

function session(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    loading: false,
    signedOut: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    ...overrides,
  }
}

/** Shows where the guard sent the user, and the page it remembered for after sign-in. */
function Landed({ name }: { name: string }) {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <p>{from ? `${name} from ${from}` : name}</p>
}

/** /ranking is for students only, like in App.tsx. */
function renderAt(path: string, value: AuthContextValue) {
  return render(
    <AuthContext value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<Landed name="login" />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<Landed name="dashboard" />} />
            <Route element={<RequireAuth roles={["STUDENT"]} />}>
              <Route path="/ranking" element={<Landed name="ranking" />} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext>
  )
}

describe("RequireAuth", () => {
  afterEach(cleanup)

  it("sends a visitor who is not signed in to /login and remembers the page", () => {
    renderAt("/ranking", session({ user: null }))

    expect(screen.getByText("login from /ranking")).toBeTruthy()
  })

  it("does not remember the page after the user signed out", () => {
    renderAt("/ranking", session({ user: null, signedOut: true }))

    expect(screen.getByText("login")).toBeTruthy()
  })

  it("sends a user with another role to /dashboard", () => {
    renderAt("/ranking", session({ user: userWith("TEACHER") }))

    expect(screen.getByText("dashboard")).toBeTruthy()
  })

  it("shows the page to a user with the right role", () => {
    renderAt("/ranking", session({ user: userWith("STUDENT") }))

    expect(screen.getByText("ranking")).toBeTruthy()
  })

  it("waits while the saved session is being restored", () => {
    renderAt("/ranking", session({ loading: true }))

    expect(screen.queryByText(/login|dashboard|ranking/)).toBeNull()
  })
})
