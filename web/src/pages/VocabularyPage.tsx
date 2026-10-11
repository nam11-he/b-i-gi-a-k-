import { BookA, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/common/ConfirmDialog"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/common/PageHeader"
import { VocabularyFormDialog } from "@/components/VocabularyFormDialog"
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
import { Skeleton } from "@/components/ui/skeleton"
import { errorText } from "@/lib/api"
import { vocabularyApi } from "@/lib/practice"
import type { Vocabulary } from "@/types"

/** /vocabulary for students: their own notebook of words (save, edit, delete, search), with meanings hidden to self-test. */
export function VocabularyPage() {
  const [words, setWords] = useState<Vocabulary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [search, setSearch] = useState("")
  const [hideMeanings, setHideMeanings] = useState(false)
  const [revealed, setRevealed] = useState<number[]>([])
  const [dialog, setDialog] = useState<{ open: boolean; word?: Vocabulary }>({ open: false })
  const [deleteTarget, setDeleteTarget] = useState<Vocabulary | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    vocabularyApi
      .list()
      .then((result) => {
        if (cancelled) return
        setWords(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err))
      })
    return () => {
      cancelled = true
    }
  }, [version])

  const reload = () => setVersion((value) => value + 1)
  const query = search.trim().toLowerCase()
  const visible = (words ?? []).filter(
    (item) => !query || [item.word, item.meaning, item.example ?? ""].some((text) => text.toLowerCase().includes(query))
  )

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await vocabularyApi.remove(deleteTarget.id)
      toast.success(`Đã xóa từ ${deleteTarget.word}`)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setDeleting(false)
    }
  }

  const addButton = (
    <Button onClick={() => setDialog({ open: true })}>
      <Plus />
      Thêm từ
    </Button>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Sổ từ vựng" description="Sổ từ riêng của bạn. Lưu từ mới khi học, che nghĩa để tự kiểm tra lại." actions={addButton} />

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center">
            <InputGroup className="sm:max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput placeholder="Tìm từ, nghĩa, ví dụ…" value={search} onChange={(event) => setSearch(event.target.value)} />
            </InputGroup>
            <Button
              variant="outline"
              aria-pressed={hideMeanings}
              onClick={() => {
                setHideMeanings((value) => !value)
                setRevealed([])
              }}
            >
              {hideMeanings ? <Eye /> : <EyeOff />}
              {hideMeanings ? "Hiện nghĩa" : "Che nghĩa"}
            </Button>
            <p className="text-sm text-muted-foreground sm:ml-auto">{words ? `${visible.length} / ${words.length} từ` : "Đang tải…"}</p>
          </div>

          {!words ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl bg-card ring-1 ring-foreground/10">
              <EmptyState
                icon={<BookA />}
                title={words.length === 0 ? "Sổ từ vựng còn trống" : "Không có từ khớp từ khóa"}
                description={words.length === 0 ? "Gặp từ mới trong bài học thì lưu lại đây để ôn." : undefined}
                action={words.length === 0 ? addButton : undefined}
              />
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Các từ đã lưu">
              {visible.map((item) => {
                const hidden = hideMeanings && !revealed.includes(item.id)
                return (
                  <li key={item.id}>
                    <Card className="h-full">
                      <CardHeader className="flex flex-row items-start gap-2">
                        <CardTitle className="min-w-0 flex-1 text-lg break-words">{item.word}</CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Thao tác với từ ${item.word}`} />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => setDialog({ open: true, word: item })}>
                              <Pencil />
                              Sửa từ
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(item)}>
                              <Trash2 />
                              Xóa từ
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {hidden ? (
                          <button
                            type="button"
                            onClick={() => setRevealed((current) => [...current, item.id])}
                            className="w-full rounded-lg bg-muted px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70"
                          >
                            Bấm để xem nghĩa
                          </button>
                        ) : (
                          <p className="text-sm font-medium break-words">{item.meaning}</p>
                        )}
                        {item.example ? <p className="text-sm break-words text-muted-foreground italic">{item.example}</p> : null}
                      </CardContent>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      <VocabularyFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        initial={dialog.word}
        onSaved={(saved) => {
          toast.success(dialog.word ? "Đã lưu thay đổi" : `Đã lưu từ ${saved.word}`)
          reload()
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Xóa từ này?"
        description={deleteTarget ? `Từ ${deleteTarget.word} sẽ bị xóa khỏi sổ từ vựng của bạn.` : undefined}
        confirmLabel="Xóa"
        variant="destructive"
        isPending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
