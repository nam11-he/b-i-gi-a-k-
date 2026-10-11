# syntax=docker/dockerfile:1.7
FROM ghcr.io/astral-sh/uv:0.12.21-python3.12-trixie-slim
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0 PYTHONUNBUFFERED=1
WORKDIR /app
# Dependencies first so they stay cached when only the source changes. One uv cache per service: the Python
# services build at the same time and would otherwise wait on each other's cache lock
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,id=uv-learning-service,target=/root/.cache/uv uv sync --locked --no-install-project --no-dev
COPY src ./src
RUN --mount=type=cache,id=uv-learning-service,target=/root/.cache/uv uv sync --locked --no-dev --no-editable
COPY alembic.ini ./
COPY alembic ./alembic
ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8084
# Apply database migrations, then start the API
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn learning_service.main:app --host 0.0.0.0 --port 8084"]
