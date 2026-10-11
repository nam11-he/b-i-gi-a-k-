"""Tables of learning_db. User ids come from auth-service: no foreign key across services."""

from datetime import date, datetime

from sqlalchemy import BigInteger, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from learning_service.db import Base

# BIGINT on PostgreSQL; INTEGER on SQLite (tests), where only INTEGER primary keys autoincrement
Id = BigInteger().with_variant(Integer(), "sqlite")


class Topic(Base):
    __tablename__ = "topics"
    __table_args__ = (UniqueConstraint("name", name="uq_topics_name"),)

    id: Mapped[int] = mapped_column(Id, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    questions: Mapped[list["Question"]] = relationship(back_populates="topic")


class Question(Base):
    """A multiple-choice question with exactly four answers A to D and one correct answer."""

    __tablename__ = "questions"
    __table_args__ = (CheckConstraint("correct_option IN ('A', 'B', 'C', 'D')", name="ck_questions_correct_option"),)

    id: Mapped[int] = mapped_column(Id, primary_key=True)
    topic_id: Mapped[int] = mapped_column(Id, ForeignKey("topics.id", ondelete="RESTRICT"), index=True)
    content: Mapped[str] = mapped_column(Text)
    option_a: Mapped[str] = mapped_column(Text)
    option_b: Mapped[str] = mapped_column(Text)
    option_c: Mapped[str] = mapped_column(Text)
    option_d: Mapped[str] = mapped_column(Text)
    correct_option: Mapped[str] = mapped_column(String(1))
    explanation: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(BigInteger, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    topic: Mapped[Topic] = relationship(back_populates="questions")


# ---------------------------------------------------------------- Phase 5: practice, vocabulary, streak, points


class PracticeSession(Base):
    """One practice round of a student: random questions, or questions of one topic."""

    __tablename__ = "practice_sessions"
    __table_args__ = (CheckConstraint("mode IN ('RANDOM', 'TOPIC')", name="ck_practice_sessions_mode"),)

    id: Mapped[int] = mapped_column(Id, primary_key=True)
    student_id: Mapped[int] = mapped_column(BigInteger, index=True)
    mode: Mapped[str] = mapped_column(String(10))
    # The topic as it was when the round started (no foreign key: the topic may be renamed or deleted later)
    topic_id: Mapped[int | None] = mapped_column(BigInteger)
    topic_name: Mapped[str | None] = mapped_column(String(255))
    question_count: Mapped[int] = mapped_column(Integer)
    correct_count: Mapped[int | None] = mapped_column(Integer)
    points_earned: Mapped[int | None] = mapped_column(Integer)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    answers: Mapped[list["PracticeAnswer"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="PracticeAnswer.position"
    )


class PracticeAnswer(Base):
    """A question of a practice round, copied from the bank when the round starts, and the student's answer."""

    __tablename__ = "practice_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_practice_answers_question"),
        CheckConstraint("correct_option IN ('A', 'B', 'C', 'D')", name="ck_practice_answers_correct_option"),
        CheckConstraint("chosen_option IN ('A', 'B', 'C', 'D')", name="ck_practice_answers_chosen_option"),
    )

    id: Mapped[int] = mapped_column(Id, primary_key=True)
    session_id: Mapped[int] = mapped_column(Id, ForeignKey("practice_sessions.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    question_id: Mapped[int] = mapped_column(BigInteger)
    content: Mapped[str] = mapped_column(Text)
    option_a: Mapped[str] = mapped_column(Text)
    option_b: Mapped[str] = mapped_column(Text)
    option_c: Mapped[str] = mapped_column(Text)
    option_d: Mapped[str] = mapped_column(Text)
    correct_option: Mapped[str] = mapped_column(String(1))
    explanation: Mapped[str | None] = mapped_column(Text)
    chosen_option: Mapped[str | None] = mapped_column(String(1))
    is_correct: Mapped[bool | None] = mapped_column(Boolean)

    session: Mapped[PracticeSession] = relationship(back_populates="answers")


class Vocabulary(Base):
    """A word in a student's own vocabulary notebook."""

    __tablename__ = "vocabularies"
    __table_args__ = (UniqueConstraint("student_id", "word", name="uq_vocabularies_student_word"),)

    id: Mapped[int] = mapped_column(Id, primary_key=True)
    student_id: Mapped[int] = mapped_column(BigInteger, index=True)
    word: Mapped[str] = mapped_column(String(100))
    meaning: Mapped[str] = mapped_column(String(500))
    example: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class StudentStreak(Base):
    """Days in a row with learning activity (practice submitted, exercise submitted or new word saved)."""

    __tablename__ = "student_streak"

    student_id: Mapped[int] = mapped_column(Id, primary_key=True, autoincrement=False)
    current_streak: Mapped[int] = mapped_column(Integer)
    longest_streak: Mapped[int] = mapped_column(Integer)
    last_active_date: Mapped[date] = mapped_column(Date)


class StudentPoint(Base):
    """Activity points earned once per source: PRACTICE:<session id> or EXERCISE:<submission id>."""

    __tablename__ = "student_points"
    __table_args__ = (
        UniqueConstraint("source_key", name="uq_student_points_source_key"),
        CheckConstraint("reason IN ('PRACTICE', 'EXERCISE')", name="ck_student_points_reason"),
    )

    id: Mapped[int] = mapped_column(Id, primary_key=True)
    student_id: Mapped[int] = mapped_column(BigInteger, index=True)
    points: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(20))
    source_key: Mapped[str] = mapped_column(String(50))
    #: Topic name of a practice round or title of an exercise, shown in the points history
    detail: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
