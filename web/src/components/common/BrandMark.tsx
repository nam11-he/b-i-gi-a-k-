import { Logo } from "@/components/common/Logo"
import { cn } from "@/lib/utils"

/** QNU crest with the app name. `collapsed` keeps only the crest (collapsed sidebar). */
export function BrandMark({ collapsed = false, size = 32, className }: { collapsed?: boolean; size?: number; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Logo size={size} />
      {collapsed ? null : (
        <span className="flex min-w-0 flex-col justify-center leading-tight">
          <span className="truncate font-heading text-sm font-semibold tracking-tight">NamBeDe</span>
          {/* Opacity instead of a fixed colour so it reads on any background */}
          <span className="truncate text-xs opacity-65">Trường Đại học Quy Nhơn</span>
        </span>
      )}
    </span>
  )
}
