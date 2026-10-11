import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  /** Number of stat tiles to fake; 0 hides the row. */
  cards?: number
  /** Number of table rows to fake; 0 hides the table. */
  rows?: number
  hideHeader?: boolean
  className?: string
}

/** Skeleton for a whole page while it loads (no full-page spinners). */
export function LoadingState({ cards = 0, rows = 6, hideHeader = false, className }: LoadingStateProps) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true">
      {hideHeader ? null : (
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      )}
      {cards > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <div key={`card-${index}`} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-9 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : null}
      {rows > 0 ? (
        <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton key={`row-${index}`} className="h-9 w-full" />
          ))}
        </div>
      ) : null}
    </div>
  )
}
