from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

_pool: ThreadedConnectionPool | None = None


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        from app.core.config import settings
        _pool = ThreadedConnectionPool(2, 20, dsn=settings.database_url)
    return _pool


@contextmanager
def get_conn():
    """Yield a psycopg2 connection from the pool.

    Auto-commits on success, rolls back on exception, always returns
    the connection to the pool.
    """
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def cursor(conn):
    """Return a RealDictCursor so rows come back as dicts."""
    return conn.cursor(cursor_factory=RealDictCursor)
