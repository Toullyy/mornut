from app.core.db import cursor, get_conn


def log_metric(
    clinic_id: str,
    metric_type: str,
    line_user_id: str = "",
    latency_ms: int | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
) -> None:
    """Fire-and-forget metric insert. Never raises."""
    try:
        with get_conn() as conn:
            with cursor(conn) as cur:
                cur.execute(
                    "INSERT INTO ai_metrics "
                    "(clinic_id, line_user_id, metric_type, latency_ms, "
                    "prompt_tokens, completion_tokens) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (
                        clinic_id,
                        line_user_id or None,
                        metric_type,
                        latency_ms,
                        prompt_tokens,
                        completion_tokens,
                    ),
                )
    except Exception as e:
        print(f"[METRICS] log_metric failed (non-fatal): {e}")


def save_internal_error(tag: str, message: str) -> None:
    """Persist a silent-failure entry. Best-effort — never raises."""
    try:
        with get_conn() as conn:
            with cursor(conn) as cur:
                cur.execute(
                    "INSERT INTO internal_errors (tag, message) VALUES (%s, %s)",
                    (tag, message[:2000]),
                )
    except Exception:
        pass


def get_health_stats(clinic_id: str, days: int = 7) -> dict:
    """Return AI health card stats for the given number of days."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                """
                SELECT
                    metric_type,
                    COUNT(*) AS cnt,
                    AVG(prompt_tokens)::int     AS avg_prompt,
                    AVG(completion_tokens)::int AS avg_completion
                FROM ai_metrics
                WHERE clinic_id = %s
                  AND created_at >= NOW() - (%s || ' days')::interval
                GROUP BY metric_type
                """,
                (clinic_id, days),
            )
            rows = cur.fetchall()

    counts: dict[str, int] = {}
    avg_prompt = avg_completion = 0
    token_rows: list[tuple[int, int]] = []

    for row in rows:
        mtype = row["metric_type"]
        counts[mtype] = row["cnt"]
        if row["avg_prompt"] and row["avg_completion"]:
            token_rows.append((row["avg_prompt"] * row["cnt"], row["avg_completion"] * row["cnt"]))

    handled = sum(counts.get(t, 0) for t in ("faq_answered", "booking", "static"))
    unknown = counts.get("faq_unknown", 0)
    offtopic = counts.get("faq_offtopic", 0)
    errors = counts.get("error", 0)
    total = handled + unknown + offtopic + errors

    total_prompt = sum(p for p, _ in token_rows)
    total_completion = sum(c for _, c in token_rows)
    token_total = sum(counts.get(t, 0) for t in ("faq_answered", "faq_unknown", "faq_offtopic"))
    if token_total > 0 and token_rows:
        avg_prompt = total_prompt // token_total
        avg_completion = total_completion // token_total

    def pct(n: int) -> float:
        return round(n / total * 100, 1) if total > 0 else 0.0

    return {
        "period_days": days,
        "total": total,
        "handled": {"count": handled, "pct": pct(handled)},
        "unknown": {"count": unknown, "pct": pct(unknown)},
        "offtopic": {"count": offtopic, "pct": pct(offtopic)},
        "errors": errors,
        "avg_prompt_tokens": avg_prompt,
        "avg_completion_tokens": avg_completion,
    }
