from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from learning_service.db import get_db
from learning_service.errors import ApiError
from learning_service.security import CurrentUser

Db = Annotated[Session, Depends(get_db)]


def ensure_can_edit(created_by: int, user: CurrentUser) -> None:
    """Shared bank: everybody reads, only the author or an admin changes."""
    if not user.is_admin and created_by != user.id:
        raise ApiError(403, "Only the author or an admin can change this")
