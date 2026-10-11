import { cn } from "@/lib/utils"

/**
 * Official crest of Trường Đại học Quy Nhơn (public/logo.svg).
 * Use it as is: never recolour, rotate or stretch it, so width and height are always equal.
 * The ring of text is unreadable below about 48px: at small sizes use BrandMark (logo + name),
 * and only show the logo alone from 96px (login page, 404 page).
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.svg"
      width={size}
      height={size}
      alt="Logo Trường Đại học Quy Nhơn"
      decoding="async"
      draggable={false}
      style={{ width: size, height: size }}
      className={cn("shrink-0 object-contain select-none", className)}
    />
  )
}
