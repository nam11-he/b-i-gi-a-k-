import { Fragment } from "react"
import { Link, useLocation } from "react-router"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { buildBreadcrumbs } from "./navigation"
import { ThemeToggle } from "./ThemeToggle"
import { UserMenu } from "./UserMenu"

/** Admin top bar: sidebar toggle, breadcrumb, light / dark switch, account menu. */
export function Header() {
  const crumbs = buildBreadcrumbs(useLocation().pathname)

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-0.5 data-vertical:h-4 data-vertical:self-center" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbItem className={index === 0 && crumbs.length > 1 ? "hidden sm:flex" : undefined}>
                  {crumb.to && !isLast ? (
                    <BreadcrumbLink render={<Link to={crumb.to} />}>{crumb.label}</BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {isLast ? null : <BreadcrumbSeparator className={index === 0 ? "hidden sm:block" : undefined} />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
