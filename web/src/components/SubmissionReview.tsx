import { CircleCheck, CircleX, Lightbulb } from "lucide-react"

import { AnswerOptions } from "@/components/AnswerOptions"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatScore, scoreTone } from "@/lib/format"
import { TONE } from "@/lib/labels"
import { cn } from "@/lib/utils"
import type { ReviewQuestion } from "@/types"

interface Graded {
  score: number | null
  correctCount: number | null
  questionCount: number
}

/** Big score out of 10 with the number of right and wrong answers (a practice round). */
export function ScoreCard({ result, label = "Điểm của bạn" }: { result: Graded; label?: string }) {
  const score = result.score ?? 0
  const correct = result.correctCount ?? 0
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-10 gap-y-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className={cn("font-heading text-5xl font-semibold tracking-tight tabular-nums", scoreTone(score))}>
            {formatScore(score)}
            <span className="text-xl text-muted-foreground"> / 10</span>
          </p>
        </div>
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-1.5">
            <CircleCheck className="size-4 text-emerald-600" aria-hidden />
            {correct} câu đúng
          </p>
          <p className="flex items-center gap-1.5">
            <CircleX className="size-4 text-rose-600" aria-hidden />
            {result.questionCount - correct} câu sai hoặc bỏ trống
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/** Every question after submitting: chosen answer, correct answer and explanation. */
export function ReviewQuestionList({ questions, chosenLabel }: { questions: ReviewQuestion[]; chosenLabel?: string }) {
  return (
    <div className="space-y-4">
      {questions.map((question) => (
        <Card key={question.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              Câu {question.position}
              {question.correct ? (
                <Badge variant="secondary" className={TONE.emerald}>
                  Đúng
                </Badge>
              ) : question.chosenOption ? (
                <Badge variant="secondary" className={TONE.rose}>
                  Sai
                </Badge>
              ) : (
                <Badge variant="secondary" className={TONE.slate}>
                  Bỏ trống
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium whitespace-pre-wrap">{question.content}</p>
            <AnswerOptions question={question} mode="review" chosen={question.chosenOption} correct={question.correctOption} chosenLabel={chosenLabel} />
            <Explanation text={question.explanation} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function Explanation({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
      <p className="whitespace-pre-wrap">
        <span className="font-medium">Giải thích: </span>
        {text}
      </p>
    </div>
  )
}
