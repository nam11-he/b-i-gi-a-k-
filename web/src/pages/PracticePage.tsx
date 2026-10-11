import { ChevronRight, History, LoaderCircle, Lock, Play, Shuffle, Sparkles, Tag } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { Link, useNavigate } from "react-router"

import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/common/PageHeader"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { errorText } from "@/lib/api"
import { formatDateTime, formatScore, scoreTone } from "@/lib/format"
import { ACCOUNT_TYPE_META } from "@/lib/labels"
import { POINT_RULES, QUESTION_COUNTS, ROUND_IN_PROGRESS_META, practiceApi, practiceTitle } from "@/lib/practice"
import { topicApi } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { PracticeLimit, PracticeMode, PracticeSummary, Topic } from "@/types"

interface PageData {
  limit: PracticeLimit
  topics: Topic[]
  rounds: PracticeSummary[]
}

/** /practice for students: start a round (random or one topic, size limited by FREE / VIP) and see past rounds. */
export function PracticePage() {
  const navigate = useNavigate()
  const [data, setData] = useState<PageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [mode, setMode] = useState<PracticeMode>("RANDOM")
  const [topicId, setTopicId] = useState("")
  const [count, setCount] = useState(10)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Learning Service asks Auth Service for FREE / VIP while answering /practice/limit
    Promise.all([practiceApi.limit(), topicApi.list(), practiceApi.sessions()])
      .then(([limit, topics, rounds]) => {
        if (cancelled) return
        setData({ limit, topics, rounds })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err))
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const header = (
    <PageHeader
      title="Luyện tập"
      description="Luyện câu trắc nghiệm trong ngân hàng câu hỏi, ngẫu nhiên hoặc theo chủ đề. Nộp xong thấy ngay đáp án, giải thích và điểm hoạt động."
    />
  )

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState message={error} onRetry={() => setVersion((value) => value + 1)} />
      </div>
    )
  }
  if (!data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  const { limit, topics, rounds } = data
  // The account may have changed from VIP to FREE since the last visit
  const questionCount = Math.min(count, limit.maxQuestions)
  const usableTopics = topics.filter((topic) => topic.questionCount > 0)

  async function start() {
    if (mode === "TOPIC" && !topicId) {
      setStartError("Chọn chủ đề để luyện tập.")
      return
    }
    setStarting(true)
    setStartError(null)
    try {
      const round = await practiceApi.start({ mode, topicId: mode === "TOPIC" ? Number(topicId) : undefined, questionCount })
      navigate(`/practice/${round.sessionId}`)
    } catch (err) {
      setStartError(
        errorText(err, {
          403: `Tài khoản ${limit.accountType} chỉ luyện tối đa ${limit.maxQuestions} câu mỗi lượt.`,
          404: "Không tìm thấy chủ đề này.",
          409: "Chưa có câu hỏi nào để luyện tập.",
        })
      )
      setStarting(false)
    }
  }

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Bắt đầu lượt mới</CardTitle>
            <CardDescription>Câu hỏi được lấy ngẫu nhiên, mỗi lượt nộp một lần.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">Chế độ</p>
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Chế độ luyện tập">
                <ModeOption icon={<Shuffle />} title="Ngẫu nhiên" description="Trộn câu hỏi của mọi chủ đề" active={mode === "RANDOM"} onSelect={() => setMode("RANDOM")} />
                <ModeOption icon={<Tag />} title="Theo chủ đề" description="Chỉ câu hỏi của một chủ đề" active={mode === "TOPIC"} onSelect={() => setMode("TOPIC")} />
              </div>
            </div>

            {mode === "TOPIC" ? (
              <div className="grid gap-2">
                <Label htmlFor="practice-topic">Chủ đề</Label>
                <NativeSelect
                  id="practice-topic"
                  value={topicId}
                  onChange={(event) => {
                    setTopicId(event.target.value)
                    setStartError(null)
                  }}
                  className="w-full sm:w-80"
                >
                  <NativeSelectOption value="" disabled>
                    Chọn chủ đề
                  </NativeSelectOption>
                  {topics.map((topic) => (
                    <NativeSelectOption key={topic.id} value={String(topic.id)} disabled={topic.questionCount === 0}>
                      {topic.name} ({topic.questionCount} câu)
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {usableTopics.length === 0 ? <p className="text-xs text-muted-foreground">Chưa có chủ đề nào có câu hỏi.</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Số câu</p>
                <StatusBadge meta={ACCOUNT_TYPE_META[limit.accountType]} />
              </div>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Số câu mỗi lượt">
                {QUESTION_COUNTS.map((value) => {
                  const locked = value > limit.maxQuestions
                  const active = value === questionCount
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={locked}
                      onClick={() => setCount(value)}
                      className={cn(
                        "inline-flex h-9 min-w-16 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-foreground/10 transition-colors",
                        active ? "bg-primary text-primary-foreground ring-primary" : "hover:bg-muted",
                        locked && "cursor-not-allowed opacity-50 hover:bg-transparent"
                      )}
                    >
                      {locked ? <Lock className="size-3.5" aria-hidden /> : null}
                      {value} câu
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {!limit.accountTypeChecked
                  ? "Chưa kiểm tra được gói tài khoản với Auth Service, tạm tính là FREE: tối đa 20 câu mỗi lượt."
                  : limit.accountType === "VIP"
                    ? "Tài khoản VIP: tối đa 50 câu mỗi lượt."
                    : "Tài khoản FREE: tối đa 20 câu mỗi lượt. Tài khoản VIP được luyện tới 50 câu."}
              </p>
            </div>

            {startError ? (
              <p role="alert" className="text-sm text-destructive">
                {startError}
              </p>
            ) : null}

            <Button size="lg" onClick={start} disabled={starting}>
              {starting ? <LoaderCircle className="animate-spin" /> : <Play />}
              Bắt đầu luyện tập
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" aria-hidden />
                Điểm hoạt động
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                {POINT_RULES.map((rule) => (
                  <li key={rule.label} className="flex items-center justify-between gap-3">
                    <span>{rule.label}</span>
                    <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">+{rule.points}</span>
                  </li>
                ))}
              </ul>
              <Link to="/ranking" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
                Xem bảng xếp hạng tuần
                <ChevronRight className="size-4" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" aria-hidden />
                Lượt gần đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rounds.length === 0 ? (
                <EmptyState title="Chưa có lượt luyện tập" description="Lượt bạn đã làm sẽ hiện ở đây." className="py-6" />
              ) : (
                <ul className="-mx-2 divide-y divide-border" aria-label="Lượt luyện tập gần đây">
                  {rounds.map((round) => (
                    <li key={round.sessionId}>
                      <Link to={`/practice/${round.sessionId}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
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
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function ModeOption({ icon, title, description, active, onSelect }: { icon: ReactNode; title: string; description: string; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl p-4 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/60",
        active && "bg-primary/5 ring-2 ring-primary hover:bg-primary/5"
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4",
          active && "bg-primary text-primary-foreground"
        )}
      >
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  )
}
