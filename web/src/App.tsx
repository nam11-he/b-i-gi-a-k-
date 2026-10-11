import { lazy } from "react"
import { BrowserRouter, Route, Routes } from "react-router"

import { AuthProvider, HomeRedirect, RequireAuth } from "@/components/AuthProvider"
import { Layout } from "@/components/Layout"
import { ThemeProvider } from "@/components/layout/ThemeProvider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useTheme } from "@/lib/theme"
import { DashboardPage } from "@/pages/DashboardPage"
import { LoginPage } from "@/pages/LoginPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { RegisterPage } from "@/pages/RegisterPage"

// Pages behind sign-in load when first opened (the shells show a skeleton meanwhile)
const PracticePage = lazy(() => import("@/pages/PracticePage").then((module) => ({ default: module.PracticePage })))
const PracticeSessionPage = lazy(() => import("@/pages/PracticeSessionPage").then((module) => ({ default: module.PracticeSessionPage })))
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then((module) => ({ default: module.ProfilePage })))
const QuestionBankPage = lazy(() => import("@/pages/QuestionBankPage").then((module) => ({ default: module.QuestionBankPage })))
const RankingPage = lazy(() => import("@/pages/RankingPage").then((module) => ({ default: module.RankingPage })))
const UsersPage = lazy(() => import("@/pages/UsersPage").then((module) => ({ default: module.UsersPage })))
const VocabularyPage = lazy(() => import("@/pages/VocabularyPage").then((module) => ({ default: module.VocabularyPage })))

/** Toasts follow the light / dark mode of the app. */
function AppToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} position="top-right" richColors closeButton />
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delay={200}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/" element={<HomeRedirect />} />
              <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/ranking" element={<RankingPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route element={<RequireAuth roles={["STUDENT"]} />}>
                    <Route path="/practice" element={<PracticePage />} />
                    <Route path="/practice/:id" element={<PracticeSessionPage />} />
                    <Route path="/vocabulary" element={<VocabularyPage />} />
                  </Route>
                  <Route element={<RequireAuth roles={["TEACHER", "ADMIN"]} />}>
                    <Route path="/questions" element={<QuestionBankPage />} />
                  </Route>
                  <Route element={<RequireAuth roles={["ADMIN"]} />}>
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
          <AppToaster />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
