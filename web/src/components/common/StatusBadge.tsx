import { Badge } from "@/components/ui/badge"
import type { EnumMeta } from "@/lib/labels"
import { cn } from "@/lib/utils"

/** Coloured badge for any enum value: <StatusBadge meta={ROLE_META[user.role]} />. */
export function StatusBadge({ meta, className }: { meta?: EnumMeta; className?: string }) {
  if (!meta) {
    return (
      <Badge variant="secondary" className={cn("bg-muted text-muted-foreground", className)}>
        Không xác định
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className={cn(meta.badge, className)}>
      {meta.label}
    </Badge>
  )
}
