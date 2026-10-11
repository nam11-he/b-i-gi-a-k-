import { CircleCheck, CircleX } from "lucide-react"

import { ANSWER_OPTIONS, optionText } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { AnswerOption } from "@/types"

type Options = { optionA: string; optionB: string; optionC: string; optionD: string }

interface AnswerOptionsProps {
  question: Options
  /** pick: the student chooses; review: after submitting (chosen vs correct); key: the lecturer's answer key */
  mode: "pick" | "review" | "key"
  chosen?: AnswerOption | null
  correct?: AnswerOption | null
  onPick?: (option: AnswerOption) => void
  disabled?: boolean
  /** Who picked the answer in review mode: "Bạn chọn" for the student, "Sinh viên chọn" for the lecturer. */
  chosenLabel?: string
}

/** The four answers of a question, in the same look everywhere. */
export function AnswerOptions({ question, mode, chosen, correct, onPick, disabled, chosenLabel = "Bạn chọn" }: AnswerOptionsProps) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Các đáp án">
      {ANSWER_OPTIONS.map((option) => {
        const isChosen = chosen === option
        const isCorrect = correct === option
        const right = (mode === "review" || mode === "key") && isCorrect
        const wrong = mode === "review" && isChosen && !isCorrect
        const selected = mode === "pick" && isChosen
        const body = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground",
                selected && "bg-primary text-primary-foreground",
                right && "bg-emerald-600 text-white",
                wrong && "bg-rose-600 text-white"
              )}
            >
              {option}
            </span>
            <span className="min-w-0 flex-1 pt-0.5 text-left break-words">{optionText(question, option)}</span>
            {right ? (
              <span className="flex items-center gap-1 pt-0.5 text-xs font-medium whitespace-nowrap text-emerald-700 dark:text-emerald-300">
                <CircleCheck className="size-4" aria-hidden />
                {mode === "review" && isChosen ? `${chosenLabel} đúng` : "Đáp án đúng"}
              </span>
            ) : null}
            {wrong ? (
              <span className="flex items-center gap-1 pt-0.5 text-xs font-medium whitespace-nowrap text-rose-700 dark:text-rose-300">
                <CircleX className="size-4" aria-hidden />
                {chosenLabel}
              </span>
            ) : null}
          </>
        )
        const frame = cn(
          "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-sm ring-1 ring-foreground/10 transition-colors",
          selected && "bg-primary/5 ring-2 ring-primary",
          right && "bg-emerald-50 text-emerald-900 ring-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200",
          wrong && "bg-rose-50 text-rose-900 ring-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
        )
        return (
          <li key={option}>
            {mode === "pick" ? (
              <button
                type="button"
                className={cn(frame, "hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60")}
                aria-pressed={isChosen}
                aria-label={`Đáp án ${option}: ${optionText(question, option)}`}
                disabled={disabled}
                onClick={() => onPick?.(option)}
              >
                {body}
              </button>
            ) : (
              <div className={frame}>{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
