"""Request and response bodies. JSON uses camelCase like the Spring services (optionA, correctOption...)."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

Option = Literal["A", "B", "C", "D"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, str_strip_whitespace=True)


class TopicIn(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class TopicOut(CamelModel):
    id: int
    name: str
    description: str | None
    question_count: int
    created_by: int
    created_by_name: str | None
    created_at: datetime


class QuestionIn(CamelModel):
    topic_id: int
    content: str = Field(min_length=1, max_length=5000)
    option_a: str = Field(min_length=1, max_length=1000)
    option_b: str = Field(min_length=1, max_length=1000)
    option_c: str = Field(min_length=1, max_length=1000)
    option_d: str = Field(min_length=1, max_length=1000)
    correct_option: Option
    explanation: str | None = Field(default=None, max_length=5000)


class QuestionOut(CamelModel):
    id: int
    topic_id: int
    topic_name: str
    content: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: Option
    explanation: str | None
    created_by: int
    created_by_name: str | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------- Phase 5: practice, vocabulary, streak, ranking

PracticeMode = Literal["RANDOM", "TOPIC"]


class PracticeLimitOut(CamelModel):
    account_type: Literal["FREE", "VIP"]
    max_questions: int
    #: False when auth-service could not be asked: the FREE limit applies meanwhile
    account_type_checked: bool


class PracticeStartIn(CamelModel):
    mode: PracticeMode
    topic_id: int | None = None
    question_count: int = Field(ge=1, le=50)

    @model_validator(mode="after")
    def topic_needed_for_topic_mode(self) -> "PracticeStartIn":
        if self.mode == "TOPIC" and self.topic_id is None:
            raise ValueError("topicId is required when mode is TOPIC")
        return self


class PracticeQuestionOut(CamelModel):
    """A question of the round, copied from the bank when it starts. `id` is the bank question id."""

    id: int
    position: int
    content: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    chosen_option: Option | None
    #: correct_option, explanation and correct stay null until the round is submitted
    correct_option: Option | None
    explanation: str | None
    correct: bool | None


class PracticeSessionSummaryOut(CamelModel):
    session_id: int
    mode: PracticeMode
    topic_id: int | None
    topic_name: str | None
    status: Literal["IN_PROGRESS", "SUBMITTED"]
    question_count: int
    correct_count: int | None
    #: Out of 10, two decimals, like exercises
    score: float | None
    points_earned: int | None
    started_at: datetime
    submitted_at: datetime | None


class PracticeSessionOut(PracticeSessionSummaryOut):
    questions: list[PracticeQuestionOut]


class PracticeAnswerIn(CamelModel):
    question_id: int
    chosen_option: Option


class PracticeSubmitIn(CamelModel):
    session_id: int
    #: Questions left out count as wrong
    answers: list[PracticeAnswerIn] = Field(default_factory=list, max_length=50)


class StreakOut(CamelModel):
    current_streak: int
    longest_streak: int
    last_active_date: date | None
    active_today: bool


class PracticeResultOut(PracticeSessionOut):
    total_points: int
    streak: StreakOut


class VocabularyIn(CamelModel):
    word: str = Field(min_length=1, max_length=100)
    meaning: str = Field(min_length=1, max_length=500)
    example: str | None = Field(default=None, max_length=1000)


class VocabularyOut(CamelModel):
    id: int
    word: str
    meaning: str
    example: str | None
    created_at: datetime
    updated_at: datetime


class PointEntryOut(CamelModel):
    points: int
    reason: Literal["PRACTICE", "EXERCISE"]
    #: Topic name of a practice round (null: random questions) or title of an exercise
    detail: str | None
    created_at: datetime


class RankingEntryOut(CamelModel):
    rank: int
    student_id: int
    #: null when auth-service could not be reached
    full_name: str | None
    points: int


class RankingMeOut(CamelModel):
    #: null while the student has no points this week
    rank: int | None
    week_points: int
    total_points: int
    recent: list[PointEntryOut]


class WeeklyRankingOut(CamelModel):
    week_start: date
    week_end: date
    entries: list[RankingEntryOut]
    #: Only for students
    me: RankingMeOut | None


# ---------------------------------------------------------------- Phase 6: questions from Excel / CSV


class ImportRowOut(CamelModel):
    #: Row number in the file (row 1 holds the column names)
    row: int
    content: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: Option | None
    explanation: str | None
    #: Empty when the row can be imported, otherwise codes such as content_missing, option_b_missing,
    #: correct_option_invalid, too_long, duplicate
    problems: list[str]


class ImportResultOut(CamelModel):
    topic_id: int
    topic_name: str
    dry_run: bool
    total: int
    valid: int
    imported: int
    rows: list[ImportRowOut]
