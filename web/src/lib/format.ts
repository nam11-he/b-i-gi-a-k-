export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN")
}

export function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN")
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
}

/** 6.666 gives "6,67". */
export function formatScore(score: number): string {
  return score.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Tailwind colour of a score out of 10: green from 8, amber from 5, red below. */
export function scoreTone(score: number): string {
  if (score >= 8) return "text-emerald-600 dark:text-emerald-400"
  if (score >= 5) return "text-amber-600 dark:text-amber-400"
  return "text-rose-600 dark:text-rose-400"
}

/** Initials for an avatar from the last two words of a Vietnamese name: "Nguyễn Văn An" gives "VA". */
export function initialsOf(fullName: string | null | undefined): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  return words
    .slice(-2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("")
}
