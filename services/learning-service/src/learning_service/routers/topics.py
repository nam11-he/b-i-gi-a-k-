from fastapi import APIRouter, Response
from sqlalchemy import func, select

from learning_service import auth_client
from learning_service.errors import ApiError
from learning_service.models import Question, Topic
from learning_service.routers.common import Db, ensure_can_edit
from learning_service.schemas import TopicIn, TopicOut
from learning_service.security import SignedIn, Staff

router = APIRouter(prefix="/topics", tags=["Chủ đề"])


def to_out(topic: Topic, question_count: int, names: dict[int, str]) -> TopicOut:
    return TopicOut(
        id=topic.id,
        name=topic.name,
        description=topic.description,
        question_count=question_count,
        created_by=topic.created_by,
        created_by_name=names.get(topic.created_by),
        created_at=topic.created_at,
    )


def ensure_unique_name(db: Db, name: str, exclude_id: int | None = None) -> None:
    query = select(Topic.id).where(func.lower(Topic.name) == name.lower())
    if exclude_id is not None:
        query = query.where(Topic.id != exclude_id)
    if db.scalar(query) is not None:
        raise ApiError(409, "A topic with this name already exists")


def find(db: Db, topic_id: int) -> Topic:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise ApiError(404, f"Topic {topic_id} not found")
    return topic


def count_questions(db: Db, topic_id: int) -> int:
    return db.scalar(select(func.count(Question.id)).where(Question.topic_id == topic_id)) or 0


@router.get("", summary="Danh sách chủ đề kèm số câu hỏi (mọi vai trò)", response_model=list[TopicOut])
def list_topics(user: SignedIn, db: Db) -> list[TopicOut]:
    """Every topic with its number of questions. Students can read topics (practice in Phase 5)."""
    rows = db.execute(
        select(Topic, func.count(Question.id)).outerjoin(Topic.questions).group_by(Topic.id).order_by(Topic.name)
    ).all()
    names = auth_client.lookup_names((topic.created_by for topic, _ in rows), user.authorization)
    return [to_out(topic, count, names) for topic, count in rows]


@router.post("", summary="Tạo chủ đề; tên trùng (không phân biệt hoa thường) thì 409 (TEACHER, ADMIN)", status_code=201, response_model=TopicOut)
def create_topic(body: TopicIn, user: Staff, db: Db) -> TopicOut:
    ensure_unique_name(db, body.name)
    topic = Topic(name=body.name, description=body.description or None, created_by=user.id)
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return to_out(topic, 0, auth_client.lookup_names([user.id], user.authorization))


@router.put("/{topic_id}", summary="Sửa chủ đề (người tạo, ADMIN)", response_model=TopicOut)
def update_topic(topic_id: int, body: TopicIn, user: Staff, db: Db) -> TopicOut:
    topic = find(db, topic_id)
    ensure_can_edit(topic.created_by, user)
    ensure_unique_name(db, body.name, exclude_id=topic.id)
    topic.name = body.name
    topic.description = body.description or None
    db.commit()
    db.refresh(topic)
    return to_out(topic, count_questions(db, topic.id), auth_client.lookup_names([topic.created_by], user.authorization))


@router.delete("/{topic_id}", summary="Xóa chủ đề; còn câu hỏi thì 409 (người tạo, ADMIN)", status_code=204)
def delete_topic(topic_id: int, user: Staff, db: Db) -> Response:
    topic = find(db, topic_id)
    ensure_can_edit(topic.created_by, user)
    if count_questions(db, topic.id) > 0:
        raise ApiError(409, "Delete or move the questions of this topic first")
    db.delete(topic)
    db.commit()
    return Response(status_code=204)
