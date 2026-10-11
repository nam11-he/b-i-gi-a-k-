import { ArrowLeft, Download, FileSearch, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ApiError, errorText } from "@/lib/api"
import { TONE } from "@/lib/labels"
import { questionApi } from "@/lib/questions"
import type { ImportProblem, ImportResult, Topic } from "@/types"

const PROBLEM_TEXT: Record<ImportProblem, string> = {
  content_missing: "Thiếu câu hỏi",
  option_a_missing: "Thiếu đáp án A",
  option_b_missing: "Thiếu đáp án B",
  option_c_missing: "Thiếu đáp án C",
  option_d_missing: "Thiếu đáp án D",
  correct_option_invalid: "Đáp án đúng phải là A, B, C hoặc D",
  too_long: "Nội dung quá dài",
  duplicate: "Trùng câu đã có",
}

/** Learning Service explains why a whole file is refused; these are the Vietnamese versions. */
const FILE_ERRORS: Record<string, string> = {
  "Only .xlsx and .csv files are supported": "Chỉ nhận file .xlsx hoặc .csv.",
  "The file could not be read as an Excel workbook": "Không đọc được file Excel này. Hãy lưu lại thành .xlsx rồi thử lại.",
  "The file has no questions": "File chưa có câu hỏi nào. Dòng 1 là tên cột, câu hỏi bắt đầu từ dòng 2.",
  "At most 200 questions per file": "Mỗi file tối đa 200 câu hỏi.",
  "The file is larger than 1 MB": "File lớn hơn 1 MB.",
  "CSV files must be saved as UTF-8": "File CSV phải lưu dạng UTF-8 (trong Excel chọn CSV UTF-8).",
}

function fileError(err: unknown): string {
  if (err instanceof ApiError && err.status === 400 && FILE_ERRORS[err.message]) return FILE_ERRORS[err.message]
  return errorText(err, { 404: "Không tìm thấy chủ đề này." })
}

interface QuestionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  topics: Topic[]
  defaultTopicId?: number
  onImported: (result: ImportResult) => void
}

/** Questions from an Excel or CSV file: pick a topic and a file, check every row, then import the valid rows. */
export function QuestionImportDialog({ open, onOpenChange, topics, defaultTopicId, onImported }: QuestionImportDialogProps) {
  const [topicId, setTopicId] = useState(defaultTopicId === undefined ? "" : String(defaultTopicId))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    if (!topicId) {
      setError("Chọn chủ đề để nhập câu hỏi vào.")
      return
    }
    if (!file) {
      setError("Chọn file .xlsx hoặc .csv.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      setPreview(await questionApi.importFile(Number(topicId), file, true))
    } catch (err) {
      setError(fileError(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!preview || !file) return
    setBusy(true)
    setError(null)
    try {
      const result = await questionApi.importFile(preview.topicId, file, false)
      const skipped = result.total - result.imported
      toast.success(`Đã nhập ${result.imported} câu hỏi vào chủ đề ${result.topicName}`, skipped > 0 ? { description: `${skipped} dòng bị bỏ qua.` } : undefined)
      onImported(result)
      onOpenChange(false)
    } catch (err) {
      setError(fileError(err))
    } finally {
      setBusy(false)
    }
  }

  async function downloadTemplate() {
    try {
      await questionApi.downloadTemplate()
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const skipped = preview ? preview.total - preview.valid : 0

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Do not close half-way through an upload
        if (busy && !next) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100svh-4rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhập câu hỏi từ Excel</DialogTitle>
          <DialogDescription>
            {preview ? "Kiểm tra từng dòng trước khi nhập. Dòng lỗi hoặc trùng câu đã có sẽ bị bỏ qua." : "Điền câu hỏi theo file mẫu rồi chọn file để xem trước."}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-3">
            <p className="text-sm">
              Chủ đề <strong>{preview.topicName}</strong>: {preview.total} dòng, <span className="font-medium text-emerald-600 dark:text-emerald-400">{preview.valid} dòng nhập được</span>
              {skipped > 0 ? (
                <>
                  , <span className="font-medium text-rose-600 dark:text-rose-400">{skipped} dòng bị bỏ qua</span>
                </>
              ) : null}
              .
            </p>
            <div className="max-h-80 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
              <Table aria-label="Xem trước các dòng">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Dòng</TableHead>
                    <TableHead>Câu hỏi</TableHead>
                    <TableHead className="w-20 text-center">Đáp án</TableHead>
                    <TableHead className="w-52">Kết quả</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="text-muted-foreground tabular-nums">{row.row}</TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        <span className="line-clamp-2">{row.content || "—"}</span>
                      </TableCell>
                      <TableCell className="text-center font-medium">{row.correctOption ?? "—"}</TableCell>
                      <TableCell className="whitespace-normal">
                        {row.problems.length === 0 ? (
                          <Badge variant="secondary" className={TONE.emerald}>
                            Nhập được
                          </Badge>
                        ) : (
                          <span className="text-xs text-rose-600 dark:text-rose-400">{row.problems.map((problem) => PROBLEM_TEXT[problem] ?? problem).join(", ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-3 text-sm">
              <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <div className="space-y-1">
                <p>Mỗi dòng một câu hỏi: Câu hỏi, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng (A đến D), Giải thích. Dòng 1 là tên cột.</p>
                <Button type="button" variant="link" className="h-auto p-0" onClick={downloadTemplate}>
                  <Download />
                  Tải file mẫu
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-topic">Chủ đề</Label>
              <NativeSelect
                id="import-topic"
                value={topicId}
                onChange={(event) => {
                  setTopicId(event.target.value)
                  setError(null)
                }}
                className="w-full"
              >
                <NativeSelectOption value="" disabled>
                  Chọn chủ đề
                </NativeSelectOption>
                {topics.map((topic) => (
                  <NativeSelectOption key={topic.id} value={String(topic.id)}>
                    {topic.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-file">File câu hỏi</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.csv"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null)
                  setError(null)
                }}
              />
              <p className="text-xs text-muted-foreground">File .xlsx hoặc .csv, tối đa 200 câu hỏi và 1 MB.</p>
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          {preview ? (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPreview(null)}>
                <ArrowLeft />
                Chọn file khác
              </Button>
              <Button type="button" disabled={busy || preview.valid === 0} onClick={confirm}>
                {busy ? <LoaderCircle className="animate-spin" /> : <Upload />}
                Nhập {preview.valid} câu
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button type="button" disabled={busy} onClick={check}>
                {busy ? <LoaderCircle className="animate-spin" /> : <FileSearch />}
                Xem trước
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
