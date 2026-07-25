import json

from app.core.db import cursor, get_conn


def save_knowledge_chunks(clinic_id: str, chunks: list[tuple[int, str, list[float]]]) -> None:
    """Delete existing chunks and insert fresh ones.

    chunks = [(chunk_index, chunk_text, embedding_floats), ...]
    Empty embedding list is stored as '[]' and signals embedding unavailable.
    """
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute("DELETE FROM knowledge_chunks WHERE clinic_id = %s", (clinic_id,))
            if not chunks:
                return
            cur.executemany(
                "INSERT INTO knowledge_chunks (clinic_id, chunk_index, chunk_text, embedding) "
                "VALUES (%s, %s, %s, %s::jsonb)",
                [(clinic_id, idx, text, json.dumps(emb)) for idx, text, emb in chunks],
            )


def load_knowledge_chunks(clinic_id: str) -> list[dict]:
    """Return list of {chunk_index, chunk_text, embedding} for a clinic."""
    with get_conn() as conn:
        with cursor(conn) as cur:
            cur.execute(
                "SELECT chunk_index, chunk_text, embedding "
                "FROM knowledge_chunks WHERE clinic_id = %s ORDER BY chunk_index",
                (clinic_id,),
            )
            rows = cur.fetchall()

    result = []
    for row in rows:
        emb = row["embedding"]
        if isinstance(emb, str):
            emb = json.loads(emb)
        elif emb is None:
            emb = []
        result.append({
            "chunk_index": row["chunk_index"],
            "chunk_text": row["chunk_text"],
            "embedding": emb,
        })
    return result
