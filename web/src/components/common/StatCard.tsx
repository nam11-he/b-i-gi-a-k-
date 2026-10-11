import type { ReactNode } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatAccent = "default" | "emerald" | "blue" | "amber" | "rose" | "violet" | "teal"

const ACCENT_CLASS: Record<StatAccent, string> = {
  default: "bg-muted text-muted-foreground",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
}

interface StatCardProps {
  title: string
  value: ReactNode
  icon: ReactNode
  hint?: ReactNode
  accent?: StatAccent
  className?: string
}

/** Number tile for dashboards: title, coloured icon, big value, small hint. */
export function StatCard({ title, value, icon, hint, accent = "default", className }: StatCardProps) {
  return (
    <Card className={cn("gap-0", className)}>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4", ACCENT_CLASS[accent])}>
            {icon}
          </span>
        </div>
        <p className="font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
