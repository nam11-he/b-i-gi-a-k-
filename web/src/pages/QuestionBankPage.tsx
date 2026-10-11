import { BookOpenCheck, FileSpreadsheet, MoreHorizontal, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"

import { AnswerOptions } from "@/components/AnswerOptions"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/common/PageHeader"
import { UserAvatar } from "@/components/common/UserAvatar"
import { QuestionFormDialog } from "@/components/QuestionFormDialog"
import { QuestionImportDialog } from "@/components/QuestionImportDialog"
import { Explanation } from "@/components/SubmissionReview"
import { TopicFormDialog } from "@/components/TopicFormDialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { errorText } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate, formatNumber } from "@/lib/format"
import { TONE } from "@/lib/labels"
import { ANSWER_OPTIONS, optionText, questionApi, topicApi } from "@/lib/questions"
import { cn } from "@/lib/utils"
import type { Question, Topic } from "@/types"

type Pending = { kind: "topic"; topic: Topic } | { kind: "question"; question: Question }

/** /questions for lecturers and admins: the shared bank of four-option questions, grouped by topic. */
export function QuestionBankPage() {
  const { user } = useAuth()
  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [topicId, setTopicId] = useState<number | undefined>(undefined)
  const [mine, setMine] = useState(false)
  const [search, setSearch] = useState("")
  const [topicDialog, setTopicDialog] = useState<{ open: boolean; topic?: Topic }>({ open: false })
  const [questionDialog, setQuestionDialog] = useState<{ open: boolean; question?: Question }>({ open: false })
  // key: every opening starts a fresh import (no file or preview left from the last time)
  const [importDialog, setImportDialog] = useState({ open: false, key: 0 })
  const [pendingDelete, setPendingDelete] = useState<Pending | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([topicApi.list(), questionApi.list({ topicId, mine })])
      .then(([topicList, questionList]) => {
        if (cancelled) return
        setTopics(topicList)
        setQuestions(questionList)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err))
      })
    return () => {
      cancelled = true
    }
  }, [topicId, mine, version])

  if (!user) return null
  const reload = () => setVersion((value) => value + 1)
  const canEdit = (createdBy: number) => user.role === "ADMIN" || createdBy === user.id
  const query = search.trim().toLowerCase()
  const visible = (questions ?? []).filter(
    (question) => !query || question.content.toLowerCase().includes(query) || ANSWER_OPTIONS.some((option) => optionText(question, option).toLowerCase().includes(query))
  )
  const totalQuestions = (topics ?? []).reduce((sum, topic) => sum + topic.questionCount, 0)
  const hasTopics = (topics ?? []).length > 0

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      if (pendingDelete.kind === "topic") {
        await topicApi.remove(pendingDelete.topic.id)
        toast.success(`Đã xóa chủ đề ${pendingDelete.topic.name}`)
        if (topicId === pendingDelete.topic.id) setTopicId(undefined)
      } else {
        await questionApi.remove(pendingDelete.question.id)
        toast.success("Đã xóa câu hỏi")
      }
      setPendingDelete(null)
      reload()
    } catch (err) {
      toast.error(errorText(err, { 409: "Chủ đề còn câu hỏi. Hãy xóa hoặc chuyển các câu hỏi sang chủ đề khác trước." }))
    } finally {
      setDeleting(false)
    }
  }

  const addQuestionButton = (
    <Button onClick={() => setQuestionDialog({ open: true })} disabled={!hasTopics}>
      <Plus />
      Thêm câu hỏi
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ngân hàng câu hỏi"
        description="Câu hỏi trắc nghiệm 4 đáp án, dùng chung cho mọi giảng viên. Bạn chỉ sửa, xóa được câu hỏi và chủ đề do mình tạo."
        actions={
          <>
            <Button variant="outline" onClick={() => setTopicDialog({ open: true })}>
              <Tag />
              Thêm chủ đề
            </Button>
            <Button variant="outline" onClick={() => setImportDialog((current) => ({ open: true, key: current.key + 1 }))} disabled={!hasTopics}>
              <FileSpreadsheet />
              Nhập từ Excel
            </Button>
            {addQuestionButton}
          </>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* Topics */}
          <Card className="h-fit gap-0 py-0 lg:sticky lg:top-20">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">Chủ đề</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {!topics ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-8 w-full" />
                  ))}
                </div>
              ) : !hasTopics ? (
                <EmptyState
                  icon={<Tag />}
                  title="Chưa có chủ đề"
                  description="Tạo chủ đề trước, rồi thêm câu hỏi vào chủ đề."
                  className="py-8"
                  action={
                    <Button size="sm" onClick={() => setTopicDialog({ open: true })}>
                      Thêm chủ đề
                    </Button>
                  }
                />
              ) : (
                <nav aria-label="Chủ đề" className="grid gap-0.5">
                  <TopicButton label="Tất cả chủ đề" count={totalQuestions} active={topicId === undefined} onClick={() => setTopicId(undefined)} />
                  {topics.map((topic) => (
                    <TopicButton
                      key={topic.id}
                      label={topic.name}
                      count={topic.questionCount}
                      active={topicId === topic.id}
                      onClick={() => setTopicId(topic.id)}
                      menu={
                        canEdit(topic.createdBy) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-xs" aria-label={`Thao tác với chủ đề ${topic.name}`} />}>
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={() => setTopicDialog({ open: true, topic })}>
                                <Pencil />
                                Sửa chủ đề
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete({ kind: "topic", topic })}>
                                <Trash2 />
                                Xóa chủ đề
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null
                      }
                    />
                  ))}
                </nav>
              )}
            </CardContent>
          </Card>

          {/* Questions */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
              <InputGroup className="sm:max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput placeholder="Tìm trong câu hỏi và đáp án…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </InputGroup>
              <NativeSelect aria-label="Lọc theo người soạn" value={mine ? "mine" : "all"} onChange={(event) => setMine(event.target.value === "mine")} className="sm:w-48">
                <NativeSelectOption value="all">Mọi người soạn</NativeSelectOption>
                <NativeSelectOption value="mine">Câu hỏi của tôi</NativeSelectOption>
              </NativeSelect>
              <p className="text-sm text-muted-foreground sm:ml-auto">{questions ? `${formatNumber(visible.length)} câu hỏi` : "Đang tải…"}</p>
            </div>

            {!questions ? (
              Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-56 w-full rounded-xl" />)
            ) : visible.length === 0 ? (
              <div className="rounded-xl bg-card ring-1 ring-foreground/10">
                <EmptyState
                  icon={<BookOpenCheck />}
                  title={questions.length === 0 ? "Chưa có câu hỏi" : "Không có câu hỏi khớp từ khóa"}
                  description={hasTopics ? "Thêm câu hỏi trắc nghiệm đầu tiên cho chủ đề này." : "Tạo chủ đề trước, rồi thêm câu hỏi."}
                  action={questions.length === 0 && hasTopics ? addQuestionButton : undefined}
                />
              </div>
            ) : (
              visible.map((question) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  canEdit={canEdit(question.createdBy)}
                  onEdit={() => setQuestionDialog({ open: true, question })}
                  onDelete={() => setPendingDelete({ kind: "question", question })}
                />
              ))
            )}
          </div>
        </div>
      )}

      <TopicFormDialog
        open={topicDialog.open}
        onOpenChange={(open) => setTopicDialog((current) => ({ ...current, open }))}
        initial={topicDialog.topic}
        onSaved={(saved) => {
          toast.success(topicDialog.topic ? "Đã lưu chủ đề" : `Đã thêm chủ đề ${saved.name}`)
          reload()
        }}
      />

      <QuestionFormDialog
        open={questionDialog.open}
        onOpenChange={(open) => setQuestionDialog((current) => ({ ...current, open }))}
        topics={topics ?? []}
        defaultTopicId={topicId}
        initial={questionDialog.question}
        onSaved={() => {
          toast.success(questionDialog.question ? "Đã lưu câu hỏi" : "Đã thêm câu hỏi vào ngân hàng")
          reload()
        }}
      />

      <QuestionImportDialog
        key={importDialog.key}
        open={importDialog.open}
        onOpenChange={(open) => setImportDialog((current) => ({ ...current, open }))}
        topics={topics ?? []}
        defaultTopicId={topicId}
        onImported={(result) => {
          setTopicId(result.topicId)
          reload()
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
        title={pendingDelete?.kind === "topic" ? "Xóa chủ đề này?" : "Xóa câu hỏi này?"}
        description={
          pendingDelete?.kind === "topic"
            ? `Chủ đề ${pendingDelete.topic.name} sẽ bị xóa. Chỉ xóa được khi chủ đề không còn câu hỏi.`
            : "Câu hỏi sẽ bị xóa khỏi ngân hàng. Các lượt luyện tập đã làm vẫn giữ bản sao của câu hỏi."
        }
        confirmLabel="Xóa"
        variant="destructive"
        isPending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function TopicButton({ label, count, active, onClick, menu }: { label: string; count: number; active: boolean; onClick: () => void; menu?: ReactNode }) {
  return (
    <div className={cn("group/topic flex items-center gap-1 rounded-md pr-1 transition-colors", active ? "bg-muted" : "hover:bg-muted/60")}>
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? "true" : undefined}
        className={cn("flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-sm", active ? "font-medium text-foreground" : "text-muted-foreground")}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="text-xs tabular-nums">{formatNumber(count)}</span>
      </button>
      {menu}
    </div>
  )
}

function QuestionCard({ question, canEdit, onEdit, onDelete }: { question: Question; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant="secondary" className={TONE.blue}>
          {question.topicName}
        </Badge>
        <span className="inline-flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <UserAvatar name={question.createdByName} size="sm" />
          <span className="truncate">{question.createdByName ?? `Giảng viên #${question.createdBy}`}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatDate(question.updatedAt)}</span>
        </span>
        {canEdit ? (
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Thao tác với câu hỏi ${question.id}`} />}>
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil />
                  Sửa câu hỏi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 />
                  Xóa câu hỏi
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="font-medium whitespace-pre-wrap text-foreground">{question.content}</p>
        <AnswerOptions question={question} mode="key" correct={question.correctOption} />
        <Explanation text={question.explanation} />
      </CardContent>
    </Card>
  )
}
