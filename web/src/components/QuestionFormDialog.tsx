import { useState, type FormEvent } from "react"

import { FormDialogShell } from "@/components/common/FormDialogShell"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import { errorText } from "@/lib/api"
import { ANSWER_OPTIONS, optionText, questionApi } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { AnswerOption, Question, Topic } from "@/types"

interface QuestionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  topics: Topic[]
  /** Topic chosen by default for a new question. */
  defaultTopicId?: number
  /** Present when editing. */
  initial?: Question
  onSaved: (question: Question) => void
}

/** Write or edit a four-option multiple-choice question. */
export function QuestionFormDialog({ open, onOpenChange, topics, defaultTopicId, initial, onSaved }: QuestionFormDialogProps) {
  return (
    // key: a fresh form each time the dialog opens, so the fields start from `initial`
    <QuestionForm key={`${initial?.id ?? "new"}-${open}`} {...{ open, onOpenChange, topics, defaultTopicId, initial, onSaved }} />
  )
}

function QuestionForm({ open, onOpenChange, topics, defaultTopicId, initial, onSaved }: QuestionFormDialogProps) {
  const [correct, setCorrect] = useState<AnswerOption | null>(initial?.correctOption ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!correct) {
      setError("Hãy chọn đáp án đúng bằng nút tròn bên trái.")
      return
    }
    const form = new FormData(event.currentTarget)
    const text = (name: string) => String(form.get(name)).trim()
    const body = {
      topicId: Number(form.get("topicId")),
      content: text("content"),
      optionA: text("optionA"),
      optionB: text("optionB"),
      optionC: text("optionC"),
      optionD: text("optionD"),
      correctOption: correct,
      explanation: text("explanation") || null,
    }
    setSubmitting(true)
    setError(null)
    try {
      onSaved(initial ? await questionApi.update(initial.id, body) : await questionApi.create(body))
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={initial ? "Sửa câu hỏi" : "Thêm câu hỏi"}
      description="Câu hỏi trắc nghiệm 4 đáp án, có đúng 1 đáp án đúng."
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitLabel={initial ? "Lưu thay đổi" : "Thêm câu hỏi"}
      error={error}
      contentClassName="sm:max-w-2xl"
    >
      <div className="grid gap-2">
        <Label htmlFor="question-topic">Chủ đề</Label>
        <NativeSelect id="question-topic" name="topicId" defaultValue={String(initial?.topicId ?? defaultTopicId ?? topics[0]?.id ?? "")} className="w-full" required>
          {topics.map((topic) => (
            <NativeSelectOption key={topic.id} value={topic.id}>
              {topic.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="question-content">Nội dung câu hỏi</Label>
        <Textarea id="question-content" name="content" defaultValue={initial?.content} placeholder="VD: She ___ to school every day." maxLength={5000} rows={3} required />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">
          Đáp án <span className="font-normal text-muted-foreground">(chọn nút tròn ở đáp án đúng)</span>
        </legend>
        {ANSWER_OPTIONS.map((option) => {
          const checked = correct === option
          return (
            <div
              key={option}
              className={cn(
                "flex items-center gap-3 rounded-lg p-1.5 pl-2.5 ring-1 ring-foreground/10 transition-colors",
                checked && "bg-emerald-50 ring-emerald-500/50 dark:bg-emerald-500/10"
              )}
            >
              <input
                type="radio"
                name="correct"
                value={option}
                checked={checked}
                onChange={() => {
                  setCorrect(option)
                  setError(null)
                }}
                aria-label={`Đáp án ${option} là đáp án đúng`}
                className="size-4 shrink-0 accent-emerald-600"
              />
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold",
                  checked && "bg-emerald-600 text-white"
                )}
              >
                {option}
              </span>
              <Input
                id={`question-option-${option}`}
                name={`option${option}`}
                defaultValue={initial ? optionText(initial, option) : undefined}
                placeholder={`Đáp án ${option}`}
                aria-label={`Đáp án ${option}`}
                maxLength={1000}
                required
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
          )
        })}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="question-explanation">Giải thích</Label>
        <Textarea
          id="question-explanation"
          name="explanation"
          defaultValue={initial?.explanation ?? ""}
          placeholder="Không bắt buộc. Sinh viên thấy phần này sau khi làm bài."
          maxLength={5000}
          rows={2}
        />
      </div>
    </FormDialogShell>
  )
}
