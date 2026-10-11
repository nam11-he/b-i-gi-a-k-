"""Practice rounds (sections 18 to 20 and 24 of the architecture document)."""

from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from fastapi import APIRouter
from sqlalchemy import func, select

from learning_service import auth_client, clock, progress
from learning_service.errors import ApiError
from learning_service.models import PracticeAnswer, PracticeSession, Question, Topic
from learning_service.routers.common import Db
from learning_service.schemas import (
    PracticeLimitOut,
    PracticeQuestionOut,
    PracticeResultOut,
    PracticeSessionOut,
    PracticeSessionSummaryOut,
    PracticeStartIn,
    PracticeSubmitIn,
)
from learning_service.security import CurrentUser, Student

router = APIRouter(prefix="/practice", tags=["Luyện tập"])

#: Questions per round by account type. Auth Service owns the FREE / VIP flag.
MAX_QUESTIONS = {"FREE": 20, "VIP": 50}
RECENT_ROUNDS = 10


def practice_limit(user: CurrentUser) -> PracticeLimitOut:
    """Learning Service asks Auth Service every time, so a switch to VIP applies at once. No answer: FREE."""
    account_type = auth_client.account_type(user.id, user.authorization)
    effective = account_type or "FREE"
    return PracticeLimitOut(account_type=effective, max_questions=MAX_QUESTIONS[effective], account_type_checked=account_type is not None)


def score_out_of_10(correct: int, total: int) -> float:
    """7 of 12 gives 5.83, rounded half up like exercise-service."""
    return float((Decimal(correct) * 10 / Decimal(total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def summary_fields(session: PracticeSession) -> dict[str, Any]:
    submitted = session.submitted_at is not None
    return {
        "session_id": session.id,
        "mode": session.mode,
        "topic_id": session.topic_id,
        "topic_name": session.topic_name,
        "status": "SUBMITTED" if submitted else "IN_PROGRESS",
        "question_count": session.question_count,
        "correct_count": session.correct_count,
        "score": score_out_of_10(session.correct_count or 0, session.question_count) if submitted else None,
        "points_earned": session.points_earned,
        "started_at": clock.as_utc(session.started_at),
        "submitted_at": clock.as_utc(session.submitted_at) if session.submitted_at else None,
    }


def question_out(answer: PracticeAnswer, reveal: bool) -> PracticeQuestionOut:
    return PracticeQuestionOut(
        id=answer.question_id,
        position=answer.position,
        content=answer.content,
        option_a=answer.option_a,
        option_b=answer.option_b,
        option_c=answer.option_c,
        option_d=answer.option_d,
        chosen_option=answer.chosen_option,
        correct_option=answer.correct_option if reveal else None,
        explanation=answer.explanation if reveal else None,
        correct=answer.is_correct if reveal else None,
    )


def session_out(session: PracticeSession) -> PracticeSessionOut:
    reveal = session.submitted_at is not None
    return PracticeSessionOut(**summary_fields(session), questions=[question_out(answer, reveal) for answer in session.answers])


def find_own(db: Db, session_id: int, user: CurrentUser) -> PracticeSession:
    session = db.get(PracticeSession, session_id)
    if session is None:
        raise ApiError(404, f"Practice round {session_id} not found")
    if session.student_id != user.id:
        raise ApiError(403, "This is not your practice round")
    return session


@router.get("/limit", summary="Số câu tối đa mỗi lượt theo gói FREE / VIP, hỏi Auth Service mỗi lần (STUDENT)", response_model=PracticeLimitOut)
def get_limit(user: Student) -> PracticeLimitOut:
    """How many questions the student may take in one round (FREE 20, VIP 50)."""
    return practice_limit(user)


@router.post("/start", summary="Bắt đầu lượt luyện tập RANDOM hoặc TOPIC; câu hỏi được chép vào lượt (STUDENT)", status_code=201, response_model=PracticeSessionOut)
def start(body: PracticeStartIn, user: Student, db: Db) -> PracticeSessionOut:
    """Random questions from the whole bank or from one topic, copied into the round. Answers stay hidden."""
    limit = practice_limit(user)
    if body.question_count > limit.max_questions:
        raise ApiError(403, f"{limit.account_type} accounts can practise at most {limit.max_questions} questions per round")
    query = select(Question)
    topic = None
    if body.mode == "TOPIC":
        topic = db.get(Topic, body.topic_id)
        if topic is None:
            raise ApiError(404, f"Topic {body.topic_id} not found")
        query = query.where(Question.topic_id == topic.id)
    questions = db.scalars(query.order_by(func.random()).limit(body.question_count)).all()
    if not questions:
        raise ApiError(409, "There are no questions to practise yet")

    session = PracticeSession(
        student_id=user.id,
        mode=body.mode,
        topic_id=topic.id if topic else None,
        topic_name=topic.name if topic else None,
        question_count=len(questions),
        started_at=clock.now(),
    )
    session.answers = [
        PracticeAnswer(
            position=position,
            question_id=question.id,
            content=question.content,
            option_a=question.option_a,
            option_b=question.option_b,
            option_c=question.option_c,
            option_d=question.option_d,
            correct_option=question.correct_option,
            explanation=question.explanation,
        )
        for position, question in enumerate(questions, start=1)
    ]
    db.add(session)
    db.commit()
    return session_out(session)


@router.post("/submit", summary="Nộp lượt luyện tập: chấm điểm, cộng điểm hoạt động, cập nhật streak (STUDENT)", response_model=PracticeResultOut)
def submit(body: PracticeSubmitIn, user: Student, db: Db) -> PracticeResultOut:
    """Grades against the copy taken at the start, adds activity points (+10, +1 per correct answer) and updates the streak."""
    session = find_own(db, body.session_id, user)
    if session.submitted_at is not None:
        raise ApiError(409, "This practice round has already been submitted")
    in_round = {answer.question_id for answer in session.answers}
    chosen: dict[int, str] = {}
    for item in body.answers:
        if item.question_id not in in_round:
            raise ApiError(400, f"Question {item.question_id} is not part of this practice round")
        chosen[item.question_id] = item.chosen_option

    correct = 0
    for answer in session.answers:
        answer.chosen_option = chosen.get(answer.question_id)
        answer.is_correct = answer.chosen_option == answer.correct_option
        correct += 1 if answer.is_correct else 0
    session.correct_count = correct
    session.points_earned = progress.PRACTICE_POINTS + correct * progress.POINTS_PER_CORRECT_ANSWER
    session.submitted_at = clock.now()
    progress.award(db, user.id, "PRACTICE", f"PRACTICE:{session.id}", session.points_earned, session.topic_name)
    streak = progress.record_active_day(db, user.id, clock.local_date(session.submitted_at))
    db.commit()
    return PracticeResultOut(
        **session_out(session).model_dump(),
        total_points=progress.total_points(db, user.id),
        streak=progress.streak_out(streak),
    )


@router.get("/sessions", summary="10 lượt luyện tập gần nhất của tôi", response_model=list[PracticeSessionSummaryOut])
def my_rounds(user: Student, db: Db) -> list[PracticeSessionSummaryOut]:
    """The student's latest rounds, newest first."""
    sessions = db.scalars(
        select(PracticeSession).where(PracticeSession.student_id == user.id).order_by(PracticeSession.id.desc()).limit(RECENT_ROUNDS)
    ).all()
    return [PracticeSessionSummaryOut(**summary_fields(session)) for session in sessions]


@router.get("/sessions/{session_id}", summary="Một lượt luyện tập của tôi", response_model=PracticeSessionOut)
def get_round(session_id: int, user: Student, db: Db) -> PracticeSessionOut:
    """One round: questions only while it is open, with answers and explanations once submitted."""
    return session_out(find_own(db, session_id, user))
