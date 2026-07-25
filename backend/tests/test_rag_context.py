"""Golden tests for rag_context pure functions (split_chunks, cosine, keyword_score).

These tests NEVER hit DB or LLM — all pure math and text processing.
"""
import math

import pytest

from app.services.rag_context import split_chunks, cosine, keyword_score, _MIN_SCORE, _CHUNK_SIZE


# ── split_chunks ───────────────────────────────────────────────────────────────

class TestSplitChunks:
    def test_empty_returns_empty(self):
        assert split_chunks("") == []

    def test_whitespace_only_returns_empty(self):
        assert split_chunks("   \n\n   ") == []

    def test_single_short_para_returns_one_chunk(self):
        text = "เวลาทำการ: จันทร์–ศุกร์ 08:00–17:00 น."
        chunks = split_chunks(text)
        assert chunks == [text]

    def test_two_paras_returns_two_chunks(self):
        text = "บรรทัดที่ 1\n\nบรรทัดที่ 2"
        chunks = split_chunks(text)
        assert len(chunks) == 2
        assert chunks[0] == "บรรทัดที่ 1"
        assert chunks[1] == "บรรทัดที่ 2"

    def test_long_para_splits_into_multiple_chunks(self):
        # Build a paragraph longer than _CHUNK_SIZE using repeated sentences
        sentence = "ข้อมูลยาว. "
        long_para = sentence * 50  # ~550 chars
        chunks = split_chunks(long_para)
        assert len(chunks) >= 2
        for c in chunks:
            assert len(c) <= _CHUNK_SIZE

    def test_triple_newline_treated_as_paragraph_break(self):
        text = "ส่วนที่ 1\n\n\nส่วนที่ 2"
        chunks = split_chunks(text)
        assert len(chunks) == 2

    def test_single_newline_stays_in_same_chunk(self):
        text = "บรรทัด 1\nบรรทัด 2"
        chunks = split_chunks(text)
        assert len(chunks) == 1

    def test_strips_leading_trailing_whitespace(self):
        text = "   ข้อมูล   "
        chunks = split_chunks(text)
        assert chunks == ["ข้อมูล"]

    def test_empty_chunks_filtered_out(self):
        # Double blank lines produce empty para strings — must be filtered
        text = "\n\n\n"
        assert split_chunks(text) == []


# ── cosine ─────────────────────────────────────────────────────────────────────

class TestCosine:
    def test_identical_vectors_return_one(self):
        v = [1.0, 2.0, 3.0]
        assert cosine(v, v) == pytest.approx(1.0, abs=1e-9)

    def test_opposite_vectors_return_minus_one(self):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cosine(a, b) == pytest.approx(-1.0, abs=1e-9)

    def test_orthogonal_vectors_return_zero(self):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert cosine(a, b) == pytest.approx(0.0, abs=1e-9)

    def test_empty_a_returns_zero(self):
        assert cosine([], [1.0, 2.0]) == 0.0

    def test_empty_b_returns_zero(self):
        assert cosine([1.0, 2.0], []) == 0.0

    def test_both_empty_returns_zero(self):
        assert cosine([], []) == 0.0

    def test_length_mismatch_returns_zero(self):
        assert cosine([1.0, 2.0], [1.0]) == 0.0

    def test_zero_vector_returns_zero(self):
        assert cosine([0.0, 0.0], [1.0, 2.0]) == 0.0

    def test_known_value(self):
        # [1, 1] vs [1, 0] → cos(45°) = 1/sqrt(2)
        result = cosine([1.0, 1.0], [1.0, 0.0])
        assert result == pytest.approx(1.0 / math.sqrt(2), abs=1e-9)


# ── keyword_score ──────────────────────────────────────────────────────────────

class TestKeywordScore:
    def test_full_overlap_returns_one(self):
        score = keyword_score("ราคา ตรวจ", "ราคา ตรวจ เลือด")
        assert score == pytest.approx(1.0)

    def test_partial_overlap(self):
        # "cat dog fish" vs "cat" → 1/3 query words found
        score = keyword_score("cat dog fish", "cat")
        assert score == pytest.approx(1 / 3, abs=1e-9)

    def test_no_overlap_returns_zero(self):
        score = keyword_score("ราคา ตรวจ", "เวลาทำการ ที่อยู่")
        assert score == 0.0

    def test_empty_query_returns_zero(self):
        assert keyword_score("", "ราคา ตรวจ") == 0.0

    def test_case_insensitive(self):
        score = keyword_score("Price CHECK", "price check service")
        assert score == pytest.approx(1.0)

    def test_above_min_score_threshold(self):
        # Chunk has exactly the query word as a standalone token
        score = keyword_score("ราคา", "ราคา 200 บาท ตรวจเลือด 300 บาท")
        assert score >= _MIN_SCORE

    def test_score_between_zero_and_one(self):
        score = keyword_score("นวด ราคา ที่อยู่", "ราคา นวด")
        assert 0.0 <= score <= 1.0
