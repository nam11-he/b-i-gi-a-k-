import { ArrowLeft, Flame, LoaderCircle, Play, Send, Sparkles, Trophy } from "lucide-react"
import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { toast } from "sonner"

import { AnswerOptions } from "@/components/AnswerOptions"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { ErrorState } from "@/components/common/ErrorState"
import { LoadingState } from "@/components/common/LoadingState"
import { PageHeader } from "@/components/common/PageHeader"
import { ReviewQuestionList, ScoreCard } from "@/components/SubmissionReview"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiError, errorText } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { TONE } from "@/lib/labels"
import { practiceApi, practiceTitle } from "@/lib/practice"
import type { AnswerOption, PracticeResult, PracticeSession } from "@/types"

type Answers = Record<number, AnswerOption>

/** Answers stay in this tab until the round is submitted, so a reload does not lose them. */
const draftKey = (sessionId: number) => `nambede.practice.${sessionId}`

function loadDraft(sessionId: number): Answers {
  try {
    const saved = sessionStorage.getItem(draftKey(sessionId))
    return saved ? (JSON.parse(saved) as Answers) : {}
  } catch {
    return {}
  }
}

function saveDraft(sessionId: number, answers: Answers | null): void {
  try {
    if (answers) sessionStorage.setItem(draftKey(sessionId), JSON.stringify(answers))
    else sessionStorage.removeItem(draftKey(sessionId))
  } catch {
    // Storage may be blocked: answers then live only in memory
  }
}

/** /practice/:id for students: answer the round, submit once, then see the score, points and explanations. */
export function PracticeSessionPage() {
  const sessionId = Number(useParams().id)
  // A new round gets fresh state
  return <PracticeRound key={sessionId} sessionId={sessionId} />
}

function PracticeRound({ sessionId }: { sessionId: number }) {
  const [round, setRound] = useState<PracticeSession | PracticeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [answers, setAnswers] = useState<Answers>(() => loadDraft(sessionId))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    practiceApi
      .session(sessionId)
      .then((result) => {
        if (cancelled) return
        setRound(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, { 400: "Không tìm thấy lượt luyện tập.", 403: "Đây không phải lượt luyện tập của bạn.", 404: "Không tìm thấy lượt luyện tập." }))
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, version])

  function pick(questionId: number, option: AnswerOption) {
    setAnswers((current) => {
      const next = { ...current, [questionId]: option }
      saveDraft(sessionId, next)
      return next
    })
  }

  async function submit() {
    setSubmitting(true)
    try {
      const chosen = Object.entries(answers).map(([questionId, chosenOption]) => ({ questionId: Number(questionId), chosenOption }))
      const result = await practiceApi.submit(sessionId, chosen)
      saveDraft(sessionId, null)
      setRound(result)
      setConfirmOpen(false)
      toast.success(`+${result.pointsEarned ?? 0} điểm hoạt động`, { description: `Chuỗi ngày học: ${result.streak.currentStreak} ngày` })
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (err) {
      toast.error(errorText(err, { 409: "Lượt luyện tập này đã được nộp." }))
      setConfirmOpen(false)
      if (err instanceof ApiError && err.status === 409) setVersion((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  const back = (
    <Link to="/practice" className={buttonVariants({ variant: "ghost", size: "sm", className: "-ml-2" })}>
      <ArrowLeft />
      Luyện tập
    </Link>
  )

  if (error) {
    return (
      <div className="space-y-4">
        {back}
        <ErrorState title="Không mở được lượt luyện tập" message={error} onRetry={() => setVersion((value) => value + 1)} />
      </div>
    )
  }
  if (!round) return <LoadingState rows={6} />

  const title = `Luyện tập: ${practiceTitle(round)}`

  if (round.status === "SUBMITTED") {
    const result = "totalPoints" in round ? round : null
    const correct = round.correctCount ?? 0
    return (
      <div className="space-y-6">
        {back}
        <PageHeader
          title={title}
          description={round.submittedAt ? `Đã nộp lúc ${formatDateTime(round.submittedAt)}` : undefined}
          actions={
            <>
              <Link to="/ranking" className={buttonVariants({ variant: "outline" })}>
                <Trophy />
                Bảng xếp hạng
              </Link>
              <Link to="/practice" className={buttonVariants()}>
                <Play />
                Luyện lượt mới
              </Link>
            </>
          }
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <ScoreCard result={round} />
          <Card>
            <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Điểm hoạt động</p>
                <p className="font-heading text-5xl font-semibold tracking-tight text-emerald-600 tabular-nums dark:text-emerald-400">
                  +{round.pointsEarned ?? 0}
                </p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5">
                  <Sparkles className="size-4 text-amber-500" aria-hidden />
                  10 điểm hoàn thành lượt, {correct} điểm cho câu đúng
                </p>
                {result ? (
                  <>
                    <p className="flex items-center gap-1.5">
                      <Trophy className="size-4 text-violet-500" aria-hidden />
                      Tổng điểm của bạn: {result.totalPoints}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Flame className="size-4 text-rose-500" aria-hidden />
                      Chuỗi ngày học: {result.streak.currentStreak} ngày (dài nhất {result.streak.longestStreak})
                    </p>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
        <ReviewQuestionList questions={round.questions} />
      </div>
    )
  }

  const answered = round.questions.filter((question) => answers[question.id]).length
  const blank = round.questionCount - answered

  return (
    <div className="space-y-6 pb-24">
      {back}
      <PageHeader title={title} description={`${round.questionCount} câu · bắt đầu lúc ${formatDateTime(round.startedAt)}. Chọn đáp án rồi bấm Nộp bài, mỗi lượt nộp một lần.`} />

      <div className="space-y-4">
        {round.questions.map((question) => {
          const chosen = answers[question.id] ?? null
          return (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                  Câu {question.position}
                  {chosen ? (
                    <Badge variant="secondary" className={TONE.blue}>
                      Đã chọn {chosen}
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="font-medium whitespace-pre-wrap">{question.content}</p>
                <AnswerOptions question={question} mode="pick" chosen={chosen} disabled={submitting} onPick={(option) => pick(question.id, option)} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Đã trả lời {answered} / {round.questionCount} câu
            </p>
            <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answered / Math.max(1, round.questionCount)) * 100}%` }} />
            </div>
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <Send />}
            Nộp bài
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Nộp lượt luyện tập?"
        description={
          blank > 0
            ? `Bạn còn ${blank} câu chưa trả lời, các câu này sẽ tính là sai. Mỗi lượt chỉ nộp được một lần.`
            : "Mỗi lượt chỉ nộp được một lần. Sau khi nộp bạn sẽ thấy điểm, đáp án đúng và giải thích."
        }
        confirmLabel="Nộp bài"
        isPending={submitting}
        onConfirm={submit}
      />
    </div>
  )
}
