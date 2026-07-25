from app.core.db import cursor, get_conn


def log_unanswered_question(clinic_id: str, question: str, line_user_id: str = "") -> None:
    """Upsert an unanswered question — increments asked_count on repeated questions.

    Logs only UNKNOWN questions (in-scope but no info). OFFTOPIC questions are
    not actionable and must not create entries here.
    """
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                INSERT INTO unanswered_questions (clinic_id, question, line_user_id, asked_count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (clinic_id, question)
                DO UPDATE SET
                    asked_count  = unanswered_questions.asked_count + 1,
                    line_user_id = COALESCE(EXCLUDED.line_user_id,
                                            unanswered_questions.line_user_id)
                """,
                (clinic_id, question, line_user_id or None),
            )


def list_unanswered_questions(clinic_id: str, include_answered: bool = False) -> list[dict]:
    """Return unanswered (or all) questions for a clinic, newest first."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            if include_answered:
                cur.execute(
                    "SELECT id::text, question, asked_count, answered, answer, "
                    "created_at, answered_at "
                    "FROM unanswered_questions WHERE clinic_id = %s "
                    "ORDER BY answered ASC, asked_count DESC, created_at DESC",
                    (clinic_id,),
                )
            else:
                cur.execute(
                    "SELECT id::text, question, asked_count, answered, answer, "
                    "created_at, answered_at "
                    "FROM unanswered_questions WHERE clinic_id = %s AND answered = FALSE "
                    "ORDER BY asked_count DESC, created_at DESC",
                    (clinic_id,),
                )
            return [dict(r) for r in cur.fetchall()]


def answer_question(question_id: str, answer: str) -> dict | None:
    """Mark a question answered and store the admin's answer. Returns updated row."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                UPDATE unanswered_questions
                SET answered = TRUE, answer = %s, answered_at = NOW()
                WHERE id = %s::uuid
                RETURNING id::text, clinic_id, question, asked_count, answered,
                          answer, created_at, answered_at
                """,
                (answer, question_id),
            )
            row = cur.fetchone()
    return dict(row) if row else None
