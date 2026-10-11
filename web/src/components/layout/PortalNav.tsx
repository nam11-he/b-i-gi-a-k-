import { useEffect, useRef } from "react"
import { Link, useLocation } from "react-router"

import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

import { PORTAL_NAV_ITEMS, isNavItemActive } from "./navigation"

/** `compact`: icons only until xl (top bar on tablets and small laptops); the phone row always shows labels. */
export function PortalNav({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const items = PORTAL_NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)))
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (compact) return
    // The phone row scrolls sideways: keep the current page's link in view
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" })
  }, [pathname, compact])

  return (
    <nav ref={navRef} aria-label="Điều hướng chính" className={cn("flex items-center gap-1", className)}>
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.to)
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            aria-label={compact ? item.label : undefined}
            title={compact ? item.label : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            <span className={compact ? "hidden xl:inline" : undefined}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
