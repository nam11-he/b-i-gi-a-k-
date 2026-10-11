import { Award, Flame, Medal, Sparkles, Star, Trophy } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"

import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { LoadingState } from "@/components/common/LoadingState"
import { PageHeader } from "@/components/common/PageHeader"
import { StatCard } from "@/components/common/StatCard"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { errorText } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDateTime, formatNumber } from "@/lib/format"
import { TONE } from "@/lib/labels"
import { POINT_RULES, formatDay, pointLabel, progressApi } from "@/lib/practice"
import { cn } from "@/lib/utils"
import type { Role, Streak, WeeklyRanking } from "@/types"

/** Students also get their streak next to the ranking. */
function loadRanking(role: Role): Promise<[WeeklyRanking, Streak | null]> {
  return Promise.all([progressApi.ranking(10), role === "STUDENT" ? progressApi.streak() : Promise.resolve(null)])
}

/** /ranking for every role: this week's top 10 by activity points; students also see their own rank and points. */
export function RankingPage() {
  const { user } = useAuth()
  const role = user?.role
  const [data, setData] = useState<[WeeklyRanking, Streak | null] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!role) return
    let cancelled = false
    loadRanking(role)
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err))
      })
    return () => {
      cancelled = true
    }
  }, [role, version])

  if (!user) return null
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bảng xếp hạng tuần" />
        <ErrorState message={error} onRetry={() => setVersion((value) => value + 1)} />
      </div>
    )
  }
  if (!data) return <LoadingState cards={user.role === "STUDENT" ? 4 : 0} rows={6} />

  const [ranking, streak] = data
  const me = ranking.me

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng xếp hạng tuần"
        description={`Từ thứ Hai ${formatDay(ranking.weekStart)} đến Chủ nhật ${formatDay(ranking.weekEnd)}. Điểm hoạt động của sinh viên trong toàn hệ thống, tính lại từ đầu mỗi tuần.`}
        actions={
          user.role === "STUDENT" ? (
            <Link to="/practice" className={buttonVariants()}>
              <Sparkles />
              Luyện tập để ghi điểm
            </Link>
          ) : null
        }
      />

      {me ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Hạng tuần này" value={me.rank ? `#${me.rank}` : "—"} icon={<Trophy />} accent="amber" hint={me.rank ? "Trong toàn hệ thống" : "Chưa có điểm tuần này"} />
          <StatCard title="Điểm tuần này" value={formatNumber(me.weekPoints)} icon={<Star />} accent="emerald" hint="Từ thứ Hai đến nay" />
          <StatCard title="Tổng điểm" value={formatNumber(me.totalPoints)} icon={<Award />} accent="violet" hint="Từ trước đến nay" />
          <StatCard
            title="Chuỗi ngày học"
            value={streak ? `${streak.currentStreak} ngày` : "—"}
            icon={<Flame />}
            accent="rose"
            hint={streak ? `Dài nhất ${streak.longestStreak} ngày` : "Chưa có dữ liệu"}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" aria-hidden />
              Top 10 tuần này
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ranking.entries.length === 0 ? (
              <EmptyState icon={<Trophy />} title="Tuần này chưa có ai ghi điểm" description="Nộp một lượt luyện tập để có tên trên bảng xếp hạng." />
            ) : (
              <ol className="space-y-1" aria-label="Bảng xếp hạng">
                {ranking.entries.map((entry) => {
                  const isMe = entry.studentId === user.id
                  return (
                    <li
                      key={entry.studentId}
                      className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5", isMe ? "bg-primary/5 ring-1 ring-primary/30" : "odd:bg-muted/40")}
                    >
                      <RankBadge rank={entry.rank} />
                      <UserAvatar name={entry.fullName} />
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate font-medium">{entry.fullName ?? `Sinh viên #${entry.studentId}`}</span>
                        {isMe ? (
                          <Badge variant="secondary" className={TONE.blue}>
                            Bạn
                          </Badge>
                        ) : null}
                      </span>
                      <span className="font-heading text-base font-semibold whitespace-nowrap tabular-nums">
                        {formatNumber(entry.points)} <span className="text-xs font-normal text-muted-foreground">điểm</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Cách tính điểm</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {POINT_RULES.map((rule) => (
                  <li key={rule.label} className="flex items-center justify-between gap-3">
                    <span>{rule.label}</span>
                    <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{rule.points}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {me ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Điểm gần đây của bạn</CardTitle>
              </CardHeader>
              <CardContent>
                {me.recent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Chưa có điểm nào. Nộp một lượt luyện tập để nhận điểm đầu tiên.</p>
                ) : (
                  <ul className="divide-y divide-border" aria-label="Điểm gần đây">
                    {me.recent.map((entry, index) => (
                      <li key={`${entry.createdAt}-${index}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{pointLabel(entry)}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{formatDateTime(entry.createdAt)}</p>
                        </div>
                        <span className="text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{entry.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const MEDALS: Record<number, string> = {
  1: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  2: "bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  3: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
}

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDALS[rank]
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums", medal ?? "text-muted-foreground")}
      aria-label={`Hạng ${rank}`}
    >
      {rank === 1 ? <Trophy className="size-4" aria-hidden /> : medal ? <Medal className="size-4" aria-hidden /> : rank}
    </span>
  )
}
