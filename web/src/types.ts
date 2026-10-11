export type Role = "ADMIN" | "TEACHER" | "STUDENT"
export type UserStatus = "ACTIVE" | "LOCKED"
export type AccountType = "FREE" | "VIP"

export interface User {
  id: number
  email: string
  fullName: string
  role: Role
  status: UserStatus
  accountType: AccountType
  createdAt: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  /** Seconds */
  expiresIn: number
  user: User
}

/** GET /api/dashboard/student: aggregated by the gateway (BFF). Learning numbers are null when learning-service cannot answer. */
export interface StudentDashboard {
  student: {
    id: number
    name: string
    email: string
    role: Role
    accountType: AccountType
  }
  /** Days in a row with learning activity */
  streak: number | null
  /** Total activity points */
  points: number | null
  /** Rank in this week's ranking, null without points this week */
  weeklyRank: number | null
}

export type AnswerOption = "A" | "B" | "C" | "D"

/** A topic of the shared question bank (learning-service). */
export interface Topic {
  id: number
  name: string
  description: string | null
  questionCount: number
  createdBy: number
  /** null when auth-service could not be reached */
  createdByName: string | null
  createdAt: string
}

/** A multiple-choice question with four answers and one correct answer. */
export interface Question {
  id: number
  topicId: number
  topicName: string
  content: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: AnswerOption
  explanation: string | null
  createdBy: number
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export type QuestionInput = Pick<Question, "topicId" | "content" | "optionA" | "optionB" | "optionC" | "optionD" | "correctOption" | "explanation">

/** Problems a row of an imported file can have; an empty list means the row can be imported. */
export type ImportProblem =
  | "content_missing"
  | "option_a_missing"
  | "option_b_missing"
  | "option_c_missing"
  | "option_d_missing"
  | "correct_option_invalid"
  | "too_long"
  | "duplicate"

export interface ImportRow {
  /** Row number in the file (row 1 holds the column names) */
  row: number
  content: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: AnswerOption | null
  explanation: string | null
  problems: ImportProblem[]
}

/** Answer of POST /questions/import: a preview (dryRun) or what was saved. */
export interface ImportResult {
  topicId: number
  topicName: string
  dryRun: boolean
  total: number
  valid: number
  imported: number
  rows: ImportRow[]
}

export type PracticeMode = "RANDOM" | "TOPIC"

/** How many questions one practice round may have: FREE 20, VIP 50 (account type asked from auth-service). */
export interface PracticeLimit {
  accountType: AccountType
  maxQuestions: number
  /** false when auth-service could not be asked: the FREE limit applies meanwhile */
  accountTypeChecked: boolean
}

/** A question of a practice round (a copy taken when the round started), shown for answering or reviewing. */
export interface ReviewQuestion {
  id: number
  position: number
  content: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  chosenOption: AnswerOption | null
  /** null until the round is submitted */
  correctOption: AnswerOption | null
  explanation: string | null
  correct: boolean | null
}

export interface PracticeSummary {
  sessionId: number
  mode: PracticeMode
  topicId: number | null
  topicName: string | null
  status: "IN_PROGRESS" | "SUBMITTED"
  questionCount: number
  correctCount: number | null
  score: number | null
  pointsEarned: number | null
  startedAt: string
  submittedAt: string | null
}

export interface PracticeSession extends PracticeSummary {
  questions: ReviewQuestion[]
}

export interface Streak {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
  activeToday: boolean
}

/** Answer of POST /practice/submit */
export interface PracticeResult extends PracticeSession {
  totalPoints: number
  streak: Streak
}

export interface Vocabulary {
  id: number
  word: string
  meaning: string
  example: string | null
  createdAt: string
  updatedAt: string
}

export interface PointEntry {
  points: number
  reason: "PRACTICE" | "EXERCISE"
  /** Topic of a practice round (null: random questions) or title of an exercise */
  detail: string | null
  createdAt: string
}

export interface RankingEntry {
  rank: number
  studentId: number
  fullName: string | null
  points: number
}

export interface WeeklyRanking {
  weekStart: string
  weekEnd: string
  entries: RankingEntry[]
  /** Only for students */
  me: { rank: number | null; weekPoints: number; totalPoints: number; recent: PointEntry[] } | null
}
