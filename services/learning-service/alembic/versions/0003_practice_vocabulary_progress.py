"""practice rounds, vocabulary notebook, streak and activity points

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "practice_sessions",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column("mode", sa.String(10), nullable=False),
        sa.Column("topic_id", sa.BigInteger(), nullable=True),
        sa.Column("topic_name", sa.String(255), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=True),
        sa.Column("points_earned", sa.Integer(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("mode IN ('RANDOM', 'TOPIC')", name="ck_practice_sessions_mode"),
    )
    op.create_index("ix_practice_sessions_student_id", "practice_sessions", ["student_id"])

    op.create_table(
        "practice_answers",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("session_id", sa.BigInteger(), sa.ForeignKey("practice_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("question_id", sa.BigInteger(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("option_a", sa.Text(), nullable=False),
        sa.Column("option_b", sa.Text(), nullable=False),
        sa.Column("option_c", sa.Text(), nullable=False),
        sa.Column("option_d", sa.Text(), nullable=False),
        sa.Column("correct_option", sa.String(1), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("chosen_option", sa.String(1), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=True),
        sa.UniqueConstraint("session_id", "question_id", name="uq_practice_answers_question"),
        sa.CheckConstraint("correct_option IN ('A', 'B', 'C', 'D')", name="ck_practice_answers_correct_option"),
        sa.CheckConstraint("chosen_option IN ('A', 'B', 'C', 'D')", name="ck_practice_answers_chosen_option"),
    )
    op.create_index("ix_practice_answers_session_id", "practice_answers", ["session_id"])

    op.create_table(
        "vocabularies",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column("word", sa.String(100), nullable=False),
        sa.Column("meaning", sa.String(500), nullable=False),
        sa.Column("example", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("student_id", "word", name="uq_vocabularies_student_word"),
    )
    op.create_index("ix_vocabularies_student_id", "vocabularies", ["student_id"])

    op.create_table(
        "student_streak",
        sa.Column("student_id", sa.BigInteger(), primary_key=True, autoincrement=False),
        sa.Column("current_streak", sa.Integer(), nullable=False),
        sa.Column("longest_streak", sa.Integer(), nullable=False),
        sa.Column("last_active_date", sa.Date(), nullable=False),
    )

    op.create_table(
        "student_points",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("student_id", sa.BigInteger(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(20), nullable=False),
        sa.Column("source_key", sa.String(50), nullable=False),
        sa.Column("detail", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("source_key", name="uq_student_points_source_key"),
        sa.CheckConstraint("reason IN ('PRACTICE', 'EXERCISE')", name="ck_student_points_reason"),
    )
    op.create_index("ix_student_points_student_id", "student_points", ["student_id"])
    op.create_index("ix_student_points_created_at", "student_points", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_student_points_created_at", table_name="student_points")
    op.drop_index("ix_student_points_student_id", table_name="student_points")
    op.drop_table("student_points")
    op.drop_table("student_streak")
    op.drop_index("ix_vocabularies_student_id", table_name="vocabularies")
    op.drop_table("vocabularies")
    op.drop_index("ix_practice_answers_session_id", table_name="practice_answers")
    op.drop_table("practice_answers")
    op.drop_index("ix_practice_sessions_student_id", table_name="practice_sessions")
    op.drop_table("practice_sessions")
