"""§6 Q&A Pipeline: Retrieval-Augmented Generation.

Chunks clinic knowledge → embeds → stores in DB.
At query time: embed question → cosine similarity → top-K chunks.
Falls back to keyword overlap when embedding fails.
Never raises — returns [] on any failure.
"""
import asyncio
import math
import re
import time

from openai import AsyncOpenAI

from app.core.config import settings
from app.services import cache as app_cache
from app.services import database as repo

_TOP_K = 4
_MIN_SCORE = 0.30
_CHUNK_SIZE = 350
_EMBED_MODEL = "text-embedding-3-small"

# Semantic cache: (clinic_id, question) → retrieved chunks; capped at 5000 entries
_Q_CACHE: dict[str, tuple[list[str], float]] = {}
_Q_TTL = 300   # 5 minutes — stays within OpenAI prompt cache TTL window
_Q_MAX = 5000


# ── Chunking ─────────────────────────────────────────────────────────────────

def split_chunks(text: str) -> list[str]:
    """Split knowledge text into paragraph-sized chunks."""
    paras = [p.strip() for p in re.split(r"\n{2,}", text.strip()) if p.strip()]
    chunks: list[str] = []
    for para in paras:
        if len(para) <= _CHUNK_SIZE:
            chunks.append(para)
        else:
            sents = re.split(r"(?<=[.!?\n])\s+", para)
            cur = ""
            for s in sents:
                if len(cur) + len(s) + 1 <= _CHUNK_SIZE:
                    cur = (cur + " " + s).strip()
                else:
                    if cur:
                        chunks.append(cur)
                    cur = s[:_CHUNK_SIZE]
            if cur:
                chunks.append(cur)
    return [c for c in chunks if c]


# ── Pure math ─────────────────────────────────────────────────────────────────

def cosine(a: list[float], b: list[float]) -> float:
    """Cosine similarity. Returns 0.0 if either vector is empty or lengths differ."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (na * nb)


def keyword_score(query: str, chunk: str) -> float:
    """Unigram recall: fraction of query words found in chunk."""
    q_words = set(re.findall(r"\w+", query.lower()))
    if not q_words:
        return 0.0
    c_words = set(re.findall(r"\w+", chunk.lower()))
    return len(q_words & c_words) / len(q_words)


# ── Embedding I/O (only I/O call; isolated for testability) ──────────────────

async def _embed(text: str) -> list[float]:
    """Embed text via OpenAI. Raises on failure — callers must catch."""
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(model=_EMBED_MODEL, input=text)
    return resp.data[0].embedding


# ── Rebuild ───────────────────────────────────────────────────────────────────

async def rebuild(clinic_id: str, knowledge_text: str) -> int:
    """Chunk + embed + save to DB. Returns number of chunks stored."""
    chunks = split_chunks(knowledge_text)
    if not chunks:
        await asyncio.to_thread(repo.save_knowledge_chunks, clinic_id, [])
        return 0

    embedded: list[tuple[int, str, list[float]]] = []
    for i, chunk in enumerate(chunks):
        try:
            emb = await _embed(chunk)
            embedded.append((i, chunk, emb))
        except Exception as e:
            print(f"[RAG] embed chunk {i} failed, storing without embedding: {e}")
            embedded.append((i, chunk, []))

    await asyncio.to_thread(repo.save_knowledge_chunks, clinic_id, embedded)
    app_cache.invalidate(clinic_id)
    _q_cache_invalidate_clinic(clinic_id)
    return len(embedded)


# ── Retrieve ──────────────────────────────────────────────────────────────────

def _q_cache_key(clinic_id: str, question: str) -> str:
    return f"{clinic_id}:{question}"


def _q_cache_get(key: str) -> tuple[bool, list[str]]:
    entry = _Q_CACHE.get(key)
    if entry is None:
        return False, []
    val, exp = entry
    if math.isfinite(exp) and time.monotonic() > exp:
        del _Q_CACHE[key]
        return False, []
    return True, val


def _q_cache_set(key: str, val: list[str]) -> None:
    if len(_Q_CACHE) >= _Q_MAX:
        try:
            del _Q_CACHE[next(iter(_Q_CACHE))]
        except StopIteration:
            pass
    _Q_CACHE[key] = (val, time.monotonic() + _Q_TTL)


def _q_cache_invalidate_clinic(clinic_id: str) -> None:
    prefix = f"{clinic_id}:"
    stale = [k for k in _Q_CACHE if k.startswith(prefix)]
    for k in stale:
        del _Q_CACHE[k]


async def retrieve(clinic_id: str, question: str) -> list[str]:
    """Return top-K relevant chunk texts. Never raises; returns [] on any failure."""
    try:
        cache_key = _q_cache_key(clinic_id, question)
        hit, cached = _q_cache_get(cache_key)
        if hit:
            return cached

        rows = await asyncio.to_thread(
            app_cache.get_knowledge_chunks, clinic_id, repo.load_knowledge_chunks
        )
        if not rows:
            return []

        use_cosine = False
        q_emb: list[float] = []
        if settings.openai_api_key:
            try:
                q_emb = await _embed(question)
                use_cosine = True
            except Exception as e:
                print(f"[RAG] embed question failed, falling back to keyword: {e}")

        scored: list[tuple[float, str]] = []
        for row in rows:
            chunk = row["chunk_text"]
            if use_cosine and row["embedding"]:
                score = cosine(q_emb, row["embedding"])
            else:
                score = keyword_score(question, chunk)
            scored.append((score, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        result = [text for score, text in scored[:_TOP_K] if score >= _MIN_SCORE]
        _q_cache_set(cache_key, result)
        return result

    except Exception as e:
        print(f"[RAG] retrieve failed (non-fatal): {e}")
        return []
