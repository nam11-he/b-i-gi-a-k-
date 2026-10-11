"""The student's own vocabulary notebook (section 21 of the architecture document): save, edit, delete, list."""

from typing import Annotated

from fastapi import APIRouter, Query, Response
from sqlalchemy import func, or_, select

from learning_service import clock, progress
from learning_service.errors import ApiError
from learning_service.models import Vocabulary
from learning_service.routers.common import Db
from learning_service.schemas import VocabularyIn, VocabularyOut
from learning_service.security import CurrentUser, Student

router = APIRouter(prefix="/vocabularies", tags=["Sổ từ vựng"])


def to_out(word: Vocabulary) -> VocabularyOut:
    return VocabularyOut(
        id=word.id,
        word=word.word,
        meaning=word.meaning,
        example=word.example,
        created_at=clock.as_utc(word.created_at),
        updated_at=clock.as_utc(word.updated_at),
    )


def find_own(db: Db, vocabulary_id: int, user: CurrentUser) -> Vocabulary:
    """Another student's word answers 404 too: notebooks are private."""
    word = db.get(Vocabulary, vocabulary_id)
    if word is None or word.student_id != user.id:
        raise ApiError(404, f"Word {vocabulary_id} not found")
    return word


def ensure_new_word(db: Db, user: CurrentUser, text: str, exclude_id: int | None = None) -> None:
    query = select(Vocabulary.id).where(Vocabulary.student_id == user.id, func.lower(Vocabulary.word) == text.lower())
    if exclude_id is not None:
        query = query.where(Vocabulary.id != exclude_id)
    if db.scalar(query) is not None:
        raise ApiError(409, "This word is already in your notebook")


@router.get("", summary="Sổ từ của tôi, mới nhất trước; q tìm trong từ và nghĩa (STUDENT)", response_model=list[VocabularyOut])
def list_words(user: Student, db: Db, q: Annotated[str | None, Query(max_length=100)] = None) -> list[VocabularyOut]:
    """Newest first; `q` searches words and meanings."""
    query = select(Vocabulary).where(Vocabulary.student_id == user.id).order_by(Vocabulary.id.desc())
    if q and q.strip():
        text = q.strip()
        query = query.where(or_(Vocabulary.word.icontains(text, autoescape=True), Vocabulary.meaning.icontains(text, autoescape=True)))
    return [to_out(word) for word in db.scalars(query)]


@router.post("", summary="Thêm từ; từ đã có trong sổ thì 409", status_code=201, response_model=VocabularyOut)
def add_word(body: VocabularyIn, user: Student, db: Db) -> VocabularyOut:
    """Saving a new word counts as a learning day for the streak."""
    ensure_new_word(db, user, body.word)
    word = Vocabulary(student_id=user.id, word=body.word, meaning=body.meaning, example=body.example or None)
    db.add(word)
    progress.record_active_day(db, user.id, clock.today())
    db.commit()
    db.refresh(word)
    return to_out(word)


@router.put("/{vocabulary_id}", summary="Sửa từ", response_model=VocabularyOut)
def update_word(vocabulary_id: int, body: VocabularyIn, user: Student, db: Db) -> VocabularyOut:
    word = find_own(db, vocabulary_id, user)
    ensure_new_word(db, user, body.word, exclude_id=word.id)
    word.word = body.word
    word.meaning = body.meaning
    word.example = body.example or None
    db.commit()
    db.refresh(word)
    return to_out(word)


@router.delete("/{vocabulary_id}", summary="Xóa từ", status_code=204)
def delete_word(vocabulary_id: int, user: Student, db: Db) -> Response:
    db.delete(find_own(db, vocabulary_id, user))
    db.commit()
    return Response(status_code=204)
