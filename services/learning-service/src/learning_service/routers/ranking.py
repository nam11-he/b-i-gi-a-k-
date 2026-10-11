"""Weekly ranking by activity points (section 23 of the architecture document)."""

from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from learning_service import auth_client, clock, progress
from learning_service.models import StudentPoint
from learning_service.routers.common import Db
from learning_service.schemas import PointEntryOut, RankingEntryOut, RankingMeOut, WeeklyRankingOut
from learning_service.security import SignedIn

router = APIRouter(prefix="/ranking", tags=["Xếp hạng"])

RECENT_POINTS = 10


@router.get("/weekly", summary="Xếp hạng tuần (thứ Hai đến Chủ nhật, giờ Việt Nam); sinh viên có thêm hạng của mình", response_model=WeeklyRankingOut)
def weekly(user: SignedIn, db: Db, limit: Annotated[int, Query(ge=0, le=50)] = 10) -> WeeklyRankingOut:
    """Points earned this week (Monday to Sunday, local time) by every student, highest first.

    Equal points share a rank (1, 2, 2, 4). Students also get their own rank, totals and latest points.
    """
    monday, sunday, start, end = progress.week_range(clock.today())
    week_points = func.sum(StudentPoint.points)
    rows = db.execute(
        select(StudentPoint.student_id, week_points)
        .where(StudentPoint.created_at >= start, StudentPoint.created_at < end)
        .group_by(StudentPoint.student_id)
        .order_by(week_points.desc(), StudentPoint.student_id)
    ).all()
    ranked: list[tuple[int, int, int]] = []
    for position, (student_id, points) in enumerate(rows, start=1):
        rank = ranked[-1][0] if ranked and ranked[-1][2] == points else position
        ranked.append((rank, student_id, int(points)))

    top = ranked[:limit]
    names = auth_client.lookup_names((student_id for _, student_id, _ in top), user.authorization)
    me = None
    if user.role == "STUDENT":
        mine = next((row for row in ranked if row[1] == user.id), None)
        recent = db.scalars(
            select(StudentPoint).where(StudentPoint.student_id == user.id).order_by(StudentPoint.id.desc()).limit(RECENT_POINTS)
        ).all()
        me = RankingMeOut(
            rank=mine[0] if mine else None,
            week_points=mine[2] if mine else 0,
            total_points=progress.total_points(db, user.id),
            recent=[
                PointEntryOut(points=entry.points, reason=entry.reason, detail=entry.detail, created_at=clock.as_utc(entry.created_at))
                for entry in recent
            ],
        )
    return WeeklyRankingOut(
        week_start=monday,
        week_end=sunday,
        entries=[RankingEntryOut(rank=rank, student_id=student_id, full_name=names.get(student_id), points=points) for rank, student_id, points in top],
        me=me,
    )
