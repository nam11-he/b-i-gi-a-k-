from typing import Annotated

from fastapi import APIRouter, File, Query, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from learning_service import auth_client, question_import
from learning_service.errors import ApiError
from learning_service.models import Question, Topic
from learning_service.routers.common import Db, ensure_can_edit
from learning_service.schemas import ImportResultOut, ImportRowOut, QuestionIn, QuestionOut
from learning_service.security import Staff

router = APIRouter(prefix="/questions", tags=["Ngân hàng câu hỏi"])


def to_out(question: Question, names: dict[int, str]) -> QuestionOut:
    return QuestionOut(
        id=question.id,
        topic_id=question.topic_id,
        topic_name=question.topic.name,
        content=question.content,
        option_a=question.option_a,
        option_b=question.option_b,
        option_c=question.option_c,
        option_d=question.option_d,
        correct_option=question.correct_option,
        explanation=question.explanation,
        created_by=question.created_by,
        created_by_name=names.get(question.created_by),
        created_at=question.created_at,
        updated_at=question.updated_at,
    )


def find(db: Db, question_id: int) -> Question:
    question = db.scalar(select(Question).options(joinedload(Question.topic)).where(Question.id == question_id))
    if question is None:
        raise ApiError(404, f"Question {question_id} not found")
    return question


def ensure_topic(db: Db, topic_id: int) -> None:
    if db.get(Topic, topic_id) is None:
        raise ApiError(400, f"Topic {topic_id} does not exist")


def apply(question: Question, body: QuestionIn) -> None:
    question.topic_id = body.topic_id
    question.content = body.content
    question.option_a = body.option_a
    question.option_b = body.option_b
    question.option_c = body.option_c
    question.option_d = body.option_d
    question.correct_option = body.correct_option
    question.explanation = body.explanation or None


@router.get("", summary="Ngân hàng câu hỏi, lọc theo chủ đề, từ khóa, câu của tôi (TEACHER, ADMIN)", response_model=list[QuestionOut])
def list_questions(
    user: Staff,
    db: Db,
    topic_id: Annotated[int | None, Query(alias="topicId")] = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    mine: bool = False,
) -> list[QuestionOut]:
    """The shared bank, newest first. Filters: topic, words in the question, only my questions."""
    query = select(Question).options(joinedload(Question.topic)).order_by(Question.id.desc())
    if topic_id is not None:
        query = query.where(Question.topic_id == topic_id)
    if q and q.strip():
        query = query.where(Question.content.icontains(q.strip(), autoescape=True))
    if mine:
        query = query.where(Question.created_by == user.id)
    questions = db.scalars(query).all()
    names = auth_client.lookup_names((question.created_by for question in questions), user.authorization)
    return [to_out(question, names) for question in questions]


@router.get("/import/template", summary="Tải file Excel mẫu để nhập câu hỏi")
def import_template(user: Staff) -> Response:
    """Excel file with the expected columns and two example questions."""
    return Response(
        content=question_import.template(),
        media_type=question_import.XLSX_TYPE,
        headers={"Content-Disposition": 'attachment; filename="mau-cau-hoi.xlsx"'},
    )


@router.post("/import", summary="Nhập câu hỏi từ .xlsx hoặc .csv; dryRun=true chỉ kiểm tra, không lưu", response_model=ImportResultOut)
def import_questions(
    user: Staff,
    db: Db,
    file: Annotated[UploadFile, File(description=".xlsx or .csv laid out like the template")],
    topic_id: Annotated[int, Query(alias="topicId")],
    dry_run: Annotated[bool, Query(alias="dryRun")] = False,
) -> ImportResultOut:
    """Checks every row; with dryRun=false also saves the rows without problems into the topic.

    Rows with problems, or with a question the topic already has, are skipped and reported.
    """
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise ApiError(404, f"Topic {topic_id} not found")
    data = file.file.read(question_import.MAX_BYTES + 1)
    if len(data) > question_import.MAX_BYTES:
        raise ApiError(400, "The file is larger than 1 MB")
    try:
        rows = question_import.check(question_import.read_rows(file.filename or "", data))
    except question_import.ImportFileError as exc:
        raise ApiError(400, str(exc)) from None

    known = {question_import.same_question_key(content) for content in db.scalars(select(Question.content).where(Question.topic_id == topic.id))}
    for row in rows:
        key = question_import.same_question_key(row.content)
        if row.content and key in known:
            row.problems.append("duplicate")
        if not row.problems:
            known.add(key)  # a broken row does not block a later, correct copy of the same question
    valid = [row for row in rows if not row.problems]
    if not dry_run and valid:
        for row in valid:
            db.add(
                Question(
                    topic_id=topic.id,
                    content=row.content,
                    option_a=row.option_a,
                    option_b=row.option_b,
                    option_c=row.option_c,
                    option_d=row.option_d,
                    correct_option=row.correct_option,
                    explanation=row.explanation,
                    created_by=user.id,
                )
            )
        db.commit()
    return ImportResultOut(
        topic_id=topic.id,
        topic_name=topic.name,
        dry_run=dry_run,
        total=len(rows),
        valid=len(valid),
        imported=0 if dry_run else len(valid),
        rows=[ImportRowOut(**vars(row)) for row in rows],
    )


@router.get("/{question_id}", summary="Một câu hỏi (TEACHER, ADMIN)", response_model=QuestionOut)
def get_question(question_id: int, user: Staff, db: Db) -> QuestionOut:
    question = find(db, question_id)
    return to_out(question, auth_client.lookup_names([question.created_by], user.authorization))


@router.post("", summary="Tạo câu hỏi trắc nghiệm 4 đáp án (TEACHER, ADMIN)", status_code=201, response_model=QuestionOut)
def create_question(body: QuestionIn, user: Staff, db: Db) -> QuestionOut:
    ensure_topic(db, body.topic_id)
    question = Question(created_by=user.id)
    apply(question, body)
    db.add(question)
    db.commit()
    return to_out(find(db, question.id), auth_client.lookup_names([user.id], user.authorization))


@router.put("/{question_id}", summary="Sửa câu hỏi (người soạn, ADMIN)", response_model=QuestionOut)
def update_question(question_id: int, body: QuestionIn, user: Staff, db: Db) -> QuestionOut:
    question = find(db, question_id)
    ensure_can_edit(question.created_by, user)
    ensure_topic(db, body.topic_id)
    apply(question, body)
    db.commit()
    db.expire_all()
    return to_out(find(db, question_id), auth_client.lookup_names([question.created_by], user.authorization))


@router.delete("/{question_id}", summary="Xóa câu hỏi (người soạn, ADMIN)", status_code=204)
def delete_question(question_id: int, user: Staff, db: Db) -> Response:
    question = find(db, question_id)
    ensure_can_edit(question.created_by, user)
    db.delete(question)
    db.commit()
    return Response(status_code=204)
