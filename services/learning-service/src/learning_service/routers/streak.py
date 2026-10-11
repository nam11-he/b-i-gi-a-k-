"""Days in a row with learning activity (section 22 of the architecture document)."""

from fastapi import APIRouter

from learning_service import progress
from learning_service.models import StudentStreak
from learning_service.routers.common import Db
from learning_service.schemas import StreakOut
from learning_service.security import Student

router = APIRouter(prefix="/streak", tags=["Chuỗi ngày học"])


@router.get("", summary="Chuỗi ngày học liên tiếp của tôi, tính theo giờ Việt Nam (STUDENT)", response_model=StreakOut)
def my_streak(user: Student, db: Db) -> StreakOut:
    """Current and longest streak. The current one drops to 0 when a whole day passes without activity."""
    return progress.streak_out(db.get(StudentStreak, user.id))
