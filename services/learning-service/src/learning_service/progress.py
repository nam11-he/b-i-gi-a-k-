"""Activity points and streaks (sections 22 and 23 of the architecture document).

Points: a finished practice round +10, each correct answer +1.
Streak: a day counts when the student submits a practice round or saves a new word.
"""

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from learning_service import clock
from learning_service.models import StudentPoint, StudentStreak
from learning_service.schemas import StreakOut

PRACTICE_POINTS = 10
POINTS_PER_CORRECT_ANSWER = 1


def award(db: Session, student_id: int, reason: str, source_key: str, points: int, detail: str | None) -> tuple[StudentPoint, bool]:
    """Adds points once per source. Returns the entry and whether it is new (False: already counted)."""
    existing = db.scalar(select(StudentPoint).where(StudentPoint.source_key == source_key))
    if existing is not None:
        return existing, False
    entry = StudentPoint(student_id=student_id, points=points, reason=reason, source_key=source_key, detail=detail, created_at=clock.now())
    db.add(entry)
    db.flush()
    return entry, True


def record_active_day(db: Session, student_id: int, day: date) -> StudentStreak:
    """Counts `day` in the student's streak: the next day extends it, a gap starts again from 1."""
    streak = db.get(StudentStreak, student_id)
    if streak is None:
        streak = StudentStreak(student_id=student_id, current_streak=1, longest_streak=1, last_active_date=day)
        db.add(streak)
        db.flush()
        return streak
    if day <= streak.last_active_date:
        return streak  # already counted (or an older day reported late)
    streak.current_streak = streak.current_streak + 1 if day == streak.last_active_date + timedelta(days=1) else 1
    streak.longest_streak = max(streak.longest_streak, streak.current_streak)
    streak.last_active_date = day
    return streak


def current_streak(streak: StudentStreak | None) -> int:
    """The stored streak is still alive if the last active day was today or yesterday."""
    if streak is None or streak.last_active_date < clock.today() - timedelta(days=1):
        return 0
    return streak.current_streak


def streak_out(streak: StudentStreak | None) -> StreakOut:
    return StreakOut(
        current_streak=current_streak(streak),
        longest_streak=streak.longest_streak if streak else 0,
        last_active_date=streak.last_active_date if streak else None,
        active_today=streak is not None and streak.last_active_date == clock.today(),
    )


def total_points(db: Session, student_id: int) -> int:
    return db.scalar(select(func.coalesce(func.sum(StudentPoint.points), 0)).where(StudentPoint.student_id == student_id)) or 0


def week_range(day: date) -> tuple[date, date, datetime, datetime]:
    """Monday, Sunday, and the UTC moments where that local week starts and the next one starts."""
    monday, sunday = clock.week_of(day)
    return monday, sunday, clock.start_of(monday), clock.start_of(monday + timedelta(days=7))
