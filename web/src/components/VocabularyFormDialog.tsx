import { useState, type FormEvent } from "react"

import { FormDialogShell } from "@/components/common/FormDialogShell"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { errorText } from "@/lib/api"
import { vocabularyApi } from "@/lib/practice"
import type { Vocabulary } from "@/types"

interface VocabularyFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing a word, absent when adding one. */
  initial?: Vocabulary
  onSaved: (saved: Vocabulary) => void
}

/** Add or edit a word of the student's vocabulary notebook. */
export function VocabularyFormDialog({ open, onOpenChange, initial, onSaved }: VocabularyFormDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      word: String(form.get("word")).trim(),
      meaning: String(form.get("meaning")).trim(),
      example: String(form.get("example")).trim(),
    }
    setSubmitting(true)
    setError(null)
    try {
      onSaved(initial ? await vocabularyApi.update(initial.id, body) : await vocabularyApi.create(body))
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err, { 409: "Từ này đã có trong sổ của bạn." }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(next) => {
        if (next) setError(null)
        onOpenChange(next)
      }}
      title={initial ? "Sửa từ" : "Thêm từ mới"}
      description={initial ? undefined : "Ngày nào lưu từ mới cũng được tính vào chuỗi ngày học."}
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitLabel={initial ? "Lưu thay đổi" : "Lưu từ"}
      error={error}
    >
      {/* key: reset the fields each time the dialog opens for another word */}
      <div key={`${initial?.id ?? "new"}-${open}`} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="vocab-word">Từ</Label>
          <Input id="vocab-word" name="word" defaultValue={initial?.word} placeholder="VD: persevere" maxLength={100} autoComplete="off" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vocab-meaning">Nghĩa</Label>
          <Input id="vocab-meaning" name="meaning" defaultValue={initial?.meaning} placeholder="VD: kiên trì" maxLength={500} autoComplete="off" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vocab-example">Ví dụ</Label>
          <Textarea
            id="vocab-example"
            name="example"
            defaultValue={initial?.example ?? ""}
            placeholder="Không bắt buộc, VD: Persevere and you will succeed."
            maxLength={1000}
            rows={2}
          />
        </div>
      </div>
    </FormDialogShell>
  )
}
