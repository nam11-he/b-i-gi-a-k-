import { api, download, upload } from "@/lib/api"
import type { AnswerOption, ImportResult, Question, QuestionInput, Topic } from "@/types"

export const ANSWER_OPTIONS: AnswerOption[] = ["A", "B", "C", "D"]

/** optionA..optionD of a question by letter. */
export function optionText(question: Pick<Question, "optionA" | "optionB" | "optionC" | "optionD">, option: AnswerOption): string {
  return { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD }[option]
}

interface TopicForm {
  name: string
  description: string
}

/** Learning Service calls, always through the gateway (/api/topics, /api/questions). */
export const topicApi = {
  list: () => api<Topic[]>("/topics"),
  create: (body: TopicForm) => api<Topic>("/topics", { method: "POST", body }),
  update: (id: number, body: TopicForm) => api<Topic>(`/topics/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/topics/${id}`, { method: "DELETE" }),
}

export const questionApi = {
  list: (filters: { topicId?: number; mine?: boolean } = {}) => {
    const params = new URLSearchParams()
    if (filters.topicId !== undefined) params.set("topicId", String(filters.topicId))
    if (filters.mine) params.set("mine", "true")
    const query = params.toString()
    return api<Question[]>(query ? `/questions?${query}` : "/questions")
  },
  create: (body: QuestionInput) => api<Question>("/questions", { method: "POST", body }),
  update: (id: number, body: QuestionInput) => api<Question>(`/questions/${id}`, { method: "PUT", body }),
  remove: (id: number) => api<void>(`/questions/${id}`, { method: "DELETE" }),
  /** dryRun: check every row without saving, to show a preview first. */
  importFile: (topicId: number, file: File, dryRun: boolean) => {
    const form = new FormData()
    form.append("file", file)
    return upload<ImportResult>(`/questions/import?topicId=${topicId}&dryRun=${dryRun}`, form)
  },
  downloadTemplate: () => download("/questions/import/template", "mau-cau-hoi.xlsx"),
}
