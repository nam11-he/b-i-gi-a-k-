import { BookOpenCheck, ChevronRight, Dumbbell, Flame, FolderOpen, GraduationCap, History, Star, Trophy, UserCheck, Users } from "lucide-react"
import { useEffect, useState } from "react"
import { Link } from "react-router"

import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/common/PageHeader"
import { StatCard } from "@/components/common/StatCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { api, errorText } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDateTime, formatNumber, formatScore, scoreTone } from "@/lib/format"
import { ACCOUNT_TYPE_META, ROLE_META } from "@/lib/labels"
import { ROUND_IN_PROGRESS_META, practiceApi, practiceTitle, progressApi } from "@/lib/practice"
import { questionApi, topicApi } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { PracticeSummary, StudentDashboard, Topic, User, WeeklyRanking } from "@/types"

export function DashboardPage() {
  const { user } = useAuth()
  if (!user) return null
  if (user.role === "ADMIN") return <AdminDashboard />
  if (user.role === "TEACHER") return <TeacherDashboard user={user} />
  return <StudentHome user={user} />
}

/** Loads data once; `reload()` tries again after an error. Pass a function defined outside the component. */
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    load()
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
  }, [load, version])

  return { data, error, reload: () => setVersion((value) => value + 1) }
}

function StatsSkeleton({ count }: { count: number }) {
  return (
    <div className={count === 4 ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : "grid gap-4 sm:grid-cols-3"} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

/** Questions in the whole bank: the topics already carry their counts. */
function countQuestions(topics: Topic[]): number {
  return topics.reduce((sum, topic) => sum + topic.questionCount, 0)
}

// Loaders live outside the components so their identity never changes between renders
const loadAdminData = () => Promise.all([api<User[]>("/users"), topicApi.list()])
const loadTeacherData = () => Promise.all([topicApi.list(), questionApi.list({ mine: true })])
const loadStudentSummary = () => api<StudentDashboard>("/dashboard/student")
const loadMyRounds = () => practiceApi.sessions()
const loadTopFive = () => progressApi.ranking(5)

/* ------------------------------------------------------------------ Admin */

function AdminDashboard() {
  const { data, error, reload } = useLoad(loadAdminData)
  const ranking = useLoad(loadTopFive)
  const users = data?.[0] ?? []
  const topics = data?.[1] ?? []
  const count = (predicate: (user: User) => boolean) => users.filter(predicate).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều khiển"
        description="Tổng quan người dùng và ngân hàng câu hỏi của hệ thống NamBeDe."
        actions={
          <Link to="/users" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Users />
            Quản lý người dùng
          </Link>
        }
      />

      {error ? (
        <ErrorState title="Không tải được số liệu tổng quan" message={error} onRetry={reload} />
      ) : !data ? (
        <StatsSkeleton count={4} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Người dùng"
              value={formatNumber(users.length)}
              icon={<Users />}
              accent="violet"
              hint={`${formatNumber(count((u) => u.status === "LOCKED"))} tài khoản đang bị khóa`}
            />
            <StatCard
              title="Giảng viên"
              value={formatNumber(count((u) => u.role === "TEACHER"))}
              icon={<UserCheck />}
              accent="blue"
              hint="Do quản trị viên tạo tài khoản"
            />
            <StatCard
              title="Sinh viên"
              value={formatNumber(count((u) => u.role === "STUDENT"))}
              icon={<GraduationCap />}
              accent="teal"
              hint={`${formatNumber(count((u) => u.role === "STUDENT" && u.accountType === "VIP"))} tài khoản VIP`}
            />
            <StatCard
              title="Câu hỏi"
              value={formatNumber(countQuestions(topics))}
              icon={<BookOpenCheck />}
              accent="amber"
              hint={`Trong ${formatNumber(topics.length)} chủ đề`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Người dùng mới</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {[...users]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 5)
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <UserAvatar name={item.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                      </div>
                      <StatusBadge meta={ROLE_META[item.role]} />
                    </div>
                  ))}
              </CardContent>
            </Card>

            <RankingCard ranking={ranking.data} error={ranking.error} onRetry={ranking.reload} />
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Teacher */

function TeacherDashboard({ user }: { user: User }) {
  const { data, error, reload } = useLoad(loadTeacherData)
  const ranking = useLoad(loadTopFive)
  const topics = data?.[0]
  const myQuestions = data?.[1] ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Chào ${user.fullName}`}
        documentTitle="Tổng quan"
        description="Soạn ngân hàng câu hỏi dùng chung và theo dõi bảng xếp hạng của sinh viên."
        actions={
          <Link to="/questions" className={buttonVariants({ size: "sm" })}>
            <BookOpenCheck />
            Ngân hàng câu hỏi
          </Link>
        }
      />

      {error ? (
        <ErrorState title="Không tải được ngân hàng câu hỏi" message={error} onRetry={reload} />
      ) : !topics ? (
        <StatsSkeleton count={3} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Chủ đề" value={formatNumber(topics.length)} icon={<FolderOpen />} accent="blue" hint="Dùng chung cho mọi giảng viên" />
            <StatCard title="Câu hỏi trong ngân hàng" value={formatNumber(countQuestions(topics))} icon={<BookOpenCheck />} accent="teal" hint="Sinh viên luyện tập từ ngân hàng này" />
            <StatCard
              title="Câu hỏi đã soạn"
              value={formatNumber(myQuestions.length)}
              icon={<UserCheck />}
              accent="violet"
              hint={
                <Link to="/questions" className="font-medium text-foreground hover:underline">
                  Mở ngân hàng câu hỏi
                </Link>
              }
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <TopicsCard topics={topics} />
            <RankingCard ranking={ranking.data} error={ranking.error} onRetry={ranking.reload} />
          </div>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- Student */

function StudentHome({ user }: { user: User }) {
  const summary = useLoad(loadStudentSummary)
  const rounds = useLoad(loadMyRounds)
  const ranking = useLoad(loadTopFive)
  const data = summary.data
  const missing = "Chưa có dữ liệu"

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Chào ${user.fullName}`}
        documentTitle="Tổng quan"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Sinh viên Trường Đại học Quy Nhơn
            <StatusBadge meta={ACCOUNT_TYPE_META[user.accountType]} />
          </span>
        }
        actions={
          <Link to="/practice" className={buttonVariants({ size: "sm" })}>
            <Dumbbell />
            Luyện tập
          </Link>
        }
      />

      {/* One call, the gateway gathers Auth Service and Learning Service (BFF) */}
      {summary.error ? (
        <ErrorState title="Không tải được tiến độ học tập" message={summary.error} onRetry={summary.reload} />
      ) : !data ? (
        <StatsSkeleton count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Chuỗi ngày học"
            value={data.streak === null ? "—" : `${data.streak} ngày`}
            icon={<Flame />}
            accent="rose"
            hint={data.streak === null ? missing : "Ngày học liên tiếp"}
          />
          <StatCard
            title="Điểm hoạt động"
            value={data.points === null ? "—" : formatNumber(data.points)}
            icon={<Star />}
            accent="emerald"
            hint={data.points === null ? missing : "Tổng điểm từ trước tới nay"}
          />
          <StatCard
            title="Hạng tuần này"
            value={data.weeklyRank ? `#${data.weeklyRank}` : "—"}
            icon={<Trophy />}
            accent="amber"
            hint={
              data.points === null ? (
                missing
              ) : (
                <Link to="/ranking" className="font-medium text-foreground hover:underline">
                  {data.weeklyRank ? "Xem bảng xếp hạng" : "Chưa có điểm tuần này"}
                </Link>
              )
            }
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {rounds.error ? (
          <ErrorState title="Không tải được lượt luyện tập" message={rounds.error} onRetry={rounds.reload} />
        ) : rounds.data ? (
          <RecentRoundsCard rounds={rounds.data} />
        ) : null}
        <RankingCard ranking={ranking.data} error={ranking.error} onRetry={ranking.reload} highlightId={user.id} />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Shared */

/** Lecturer: the topics of the shared bank with their number of questions. */
function TopicsCard({ topics }: { topics: Topic[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Chủ đề trong ngân hàng</CardTitle>
        <CardAction>
          <Link to="/questions" className={buttonVariants({ variant: "ghost", size: "xs" })}>
            Xem tất cả
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {topics.length === 0 ? (
          <EmptyState
            icon={<FolderOpen />}
            title="Chưa có chủ đề nào"
            description="Tạo chủ đề rồi thêm câu hỏi, hoặc nhập câu hỏi từ file Excel."
            action={
              <Link to="/questions" className={buttonVariants({ size: "sm" })}>
                Tạo chủ đề đầu tiên
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {topics.slice(0, 6).map((topic) => (
              <div key={topic.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                  <FolderOpen className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{topic.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Người tạo: {topic.createdByName ?? "chưa lấy được tên"}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(topic.questionCount)} câu</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Student: latest practice rounds, with the score of the submitted ones. */
function RecentRoundsCard({ rounds }: { rounds: PracticeSummary[] }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden />
          Lượt luyện tập gần đây
        </CardTitle>
        <CardAction>
          <Link to="/practice" className={buttonVariants({ variant: "ghost", size: "xs" })}>
            Luyện tập
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {rounds.length === 0 ? (
          <EmptyState
            icon={<Dumbbell />}
            title="Chưa có lượt luyện tập"
            description="Chọn ngẫu nhiên hoặc theo chủ đề, nộp xong là có điểm hoạt động."
            action={
              <Link to="/practice" className={buttonVariants({ size: "sm" })}>
                Bắt đầu luyện tập
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {rounds.slice(0, 5).map((round) => (
              <Link
                key={round.sessionId}
                to={`/practice/${round.sessionId}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{practiceTitle(round)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {round.questionCount} câu · {formatDateTime(round.startedAt)}
                  </p>
                </div>
                {round.status === "SUBMITTED" && round.score !== null ? (
                  <span className="text-right">
                    <span className={cn("block text-sm font-semibold tabular-nums", scoreTone(round.score))}>{formatScore(round.score)}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">+{round.pointsEarned ?? 0} điểm</span>
                  </span>
                ) : (
                  <StatusBadge meta={ROUND_IN_PROGRESS_META} />
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Top 5 of this week's ranking; a student sees their own line highlighted. */
function RankingCard({
  ranking,
  error,
  onRetry,
  highlightId,
}: {
  ranking: WeeklyRanking | null
  error: string | null
  onRetry: () => void
  highlightId?: number
}) {
  if (error) return <ErrorState title="Không tải được bảng xếp hạng" message={error} onRetry={onRetry} />
  if (!ranking) return null
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4 text-amber-500" aria-hidden />
          Xếp hạng tuần này
        </CardTitle>
        <CardAction>
          <Link to="/ranking" className={buttonVariants({ variant: "ghost", size: "xs" })}>
            Xem tất cả
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {ranking.entries.length === 0 ? (
          <EmptyState icon={<Trophy />} title="Tuần này chưa có ai ghi điểm" description="Sinh viên nộp lượt luyện tập để có tên trên bảng xếp hạng." />
        ) : (
          <ol className="divide-y divide-border" aria-label="Xếp hạng tuần này">
            {ranking.entries.map((entry) => (
              <li
                key={entry.studentId}
                className={cn("flex items-center gap-3 py-2.5 first:pt-0 last:pb-0", entry.studentId === highlightId && "font-semibold")}
              >
                <span className="w-6 text-center text-sm font-semibold text-muted-foreground tabular-nums">{entry.rank}</span>
                <UserAvatar name={entry.fullName} />
                <span className="min-w-0 flex-1 truncate text-sm">{entry.fullName ?? `Sinh viên #${entry.studentId}`}</span>
                <span className="text-sm tabular-nums">
                  {formatNumber(entry.points)} <span className="text-xs font-normal text-muted-foreground">điểm</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
