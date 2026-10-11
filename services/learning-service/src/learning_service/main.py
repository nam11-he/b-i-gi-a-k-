from typing import Annotated, Any

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from learning_service import requestid
from learning_service.db import engine
from learning_service.errors import register_error_handlers
from learning_service.routers import practice, questions, ranking, streak, topics, vocabularies
from learning_service.security import CurrentUser, get_current_user

requestid.setup_logging()

app = FastAPI(
    title="NamBeDe Learning Service",
    description="Chủ đề, ngân hàng câu hỏi dùng chung, luyện tập, sổ từ vựng, streak, điểm hoạt động, xếp hạng tuần. "
    "Qua gateway: /api/topics, /api/questions, /api/practice, /api/vocabularies, /api/streak, /api/ranking.",
    version="0.1.0",
    swagger_ui_parameters={"persistAuthorization": True},  # keep the token after a page reload
)
register_error_handlers(app)
requestid.install(app)


@app.get("/health", tags=["Hệ thống"], summary="Service và database còn chạy không (không cần token)")
def health() -> Any:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(status_code=503, content={"status": "DOWN", "db": "DOWN"})
    return {"status": "UP", "db": "UP"}


@app.get("/topics/ping", include_in_schema=False)
def ping(caller: Annotated[CurrentUser, Depends(get_current_user)]) -> dict[str, Any]:
    """Phase 1 check that the service is reachable through the gateway and accepts the shared JWT."""
    return {"service": "learning-service", "userId": caller.id, "role": caller.role}


# After /topics/ping so the literal path keeps matching first
app.include_router(topics.router)
app.include_router(questions.router)
app.include_router(practice.router)
app.include_router(vocabularies.router)
app.include_router(streak.router)
app.include_router(ranking.router)
