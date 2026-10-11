import { useState, type FormEvent } from "react"

import { FormDialogShell } from "@/components/common/FormDialogShell"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { errorText } from "@/lib/api"
import { topicApi } from "@/lib/questions"
import type { Topic } from "@/types"

interface TopicFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing. */
  initial?: Topic
  onSaved: (topic: Topic) => void
}

export function TopicFormDialog({ open, onOpenChange, initial, onSaved }: TopicFormDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = { name: String(form.get("name")).trim(), description: String(form.get("description")).trim() }
    setSubmitting(true)
    setError(null)
    try {
      onSaved(initial ? await topicApi.update(initial.id, body) : await topicApi.create(body))
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err, { 409: "Đã có chủ đề với tên này." }))
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
      title={initial ? "Sửa chủ đề" : "Thêm chủ đề"}
      description={initial ? undefined : "Chủ đề dùng chung cho mọi giảng viên, ví dụ một thì ngữ pháp hoặc một chương học."}
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitLabel={initial ? "Lưu thay đổi" : "Thêm chủ đề"}
      error={error}
      contentClassName="sm:max-w-md"
    >
      <div key={`${initial?.id ?? "new"}-${open}`} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="topic-name">Tên chủ đề</Label>
          <Input id="topic-name" name="name" defaultValue={initial?.name} placeholder="VD: Thì hiện tại đơn" maxLength={255} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="topic-description">Mô tả</Label>
          <Textarea id="topic-description" name="description" defaultValue={initial?.description ?? ""} placeholder="Không bắt buộc" maxLength={2000} rows={2} />
        </div>
      </div>
    </FormDialogShell>
  )
}
