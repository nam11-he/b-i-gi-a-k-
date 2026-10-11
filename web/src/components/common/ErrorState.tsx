import { RotateCcw, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ErrorStateProps {
  title?: string
  message?: string | null
  onRetry?: () => void
  className?: string
}

/** A failed load, with a "Thử lại" button. */
export function ErrorState({ title = "Không tải được dữ liệu", message, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-12 text-center ring-1 ring-foreground/10",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {message ? <p className="mx-auto max-w-md text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw />
          Thử lại
        </Button>
      ) : null}
    </div>
  )
}
