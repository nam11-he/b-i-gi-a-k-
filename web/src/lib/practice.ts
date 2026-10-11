import { api } from "@/lib/api"
import { TONE, type EnumMeta } from "@/lib/labels"
import type { AnswerOption, PointEntry, PracticeLimit, PracticeMode, PracticeResult, PracticeSession, PracticeSummary, Streak, Vocabulary, WeeklyRanking } from "@/types"

/** Learning Service calls for practice, the vocabulary notebook, streak and ranking (through the gateway). */
export const practiceApi = {
  limit: () => api<PracticeLimit>("/practice/limit"),
  start: (body: { mode: PracticeMode; topicId?: number; questionCount: number }) => api<PracticeSession>("/practice/start", { method: "POST", body }),
  submit: (sessionId: number, answers: { questionId: number; chosenOption: AnswerOption }[]) =>
    api<PracticeResult>("/practice/submit", { method: "POST", body: { sessionId, answers } }),
  sessions: () => api<PracticeSummary[]>("/practice/sessions"),
  session: (id: number) => api<PracticeSession>(`/practice/sessions/${id}`),
}

interface VocabularyForm {
  word: string
  meaning: string
  example: string
}

export const vocabularyApi = {
  list: () => api<Vocabulary[]>("/vocabularies"),
  create: (body: VocabularyForm) => api<Vocabulary>("/vocabularies", { method: "POST", body }),
  update: (id: number, body: VocabularyForm) => api<Vocabulary>(`/vocabularies/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/vocabularies/${id}`, { method: "DELETE" }),
}

export const progressApi = {
  streak: () => api<Streak>("/streak"),
  ranking: (limit = 10) => api<WeeklyRanking>(`/ranking/weekly?limit=${limit}`),
}

/** Choices of round size; sizes above the account's limit are shown locked. */
export const QUESTION_COUNTS = [5, 10, 20, 30, 50]

/** Badge of a round started but not submitted yet. */
export const ROUND_IN_PROGRESS_META: EnumMeta = { label: "Đang làm", badge: TONE.blue }

/** Points rules from the architecture document, shown to students. */
export const POINT_RULES = [
  { label: "Hoàn thành lượt luyện tập", points: 10 },
  { label: "Mỗi câu trả lời đúng", points: 1 },
]

/** "Luyện tập: Thì quá khứ đơn", "Luyện tập ngẫu nhiên", "Bài tập: Bài 2". */
export function pointLabel(entry: PointEntry): string {
  if (entry.reason === "EXERCISE") return `Bài tập: ${entry.detail ?? "đã nộp"}`
  return entry.detail ? `Luyện tập: ${entry.detail}` : "Luyện tập ngẫu nhiên"
}

/** "Thì quá khứ đơn" or "Ngẫu nhiên" for a practice round. */
export function practiceTitle(round: Pick<PracticeSummary, "mode" | "topicName">): string {
  return round.mode === "TOPIC" ? (round.topicName ?? "Theo chủ đề") : "Ngẫu nhiên"
}

/** 01/10/2026 from "2026-10-01" without time-zone shifts. */
export function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}
