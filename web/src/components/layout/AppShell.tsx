import { Suspense } from "react"
import { Outlet } from "react-router"

import { LoadingState } from "@/components/common/LoadingState"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { AppSidebar } from "./AppSidebar"
import { Header } from "./Header"

/** Admin area: sidebar, top bar, page. */
export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0 here: a wide table must not stretch the whole column off screen */}
      <SidebarInset className="min-w-0">
        <Header />
        <div className="min-w-0 flex-1 p-4 md:p-6">
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
