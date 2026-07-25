"""Golden tests for the §2 Layer 2 Thai text compressor.

All pure — no DB, no network, no async.
"""
import pytest

from app.utils.thai_compress import compress


class TestThaiDigitNormalization:
    def test_thai_digits_converted(self):
        assert compress("นัด๑๒ คน") == "นัด12 คน"

    def test_mixed_digits_preserved(self):
        result = compress("จอง ๕ คน เวลา 10:00")
        assert "5" in result
        assert "10:00" in result

    def test_all_thai_digits(self):
        assert compress("๐๑๒๓๔๕๖๗๘๙") == "0123456789"


class TestFillerRemoval:
    def test_removes_trailing_krab(self):
        result = compress("จองครับ")
        assert "ครับ" not in result
        assert "จอง" in result

    def test_removes_trailing_ka(self):
        result = compress("สอบถามค่ะ")
        assert "ค่ะ" not in result
        assert "สอบถาม" in result

    def test_removes_trailing_nakha(self):
        result = compress("ราคาเท่าไรนะคะ")
        assert "นะคะ" not in result
        assert "ราคาเท่าไร" in result

    def test_removes_trailing_ja(self):
        result = compress("สวัสดีจ้า")
        assert "จ้า" not in result
        assert "สวัสดี" in result

    def test_removes_noi(self):
        result = compress("ช่วยดูให้หน่อย")
        assert "หน่อย" not in result
        assert "ช่วยดูให้" in result

    def test_removes_krab_pom(self):
        result = compress("สนใจครับผม")
        assert "ครับผม" not in result


class TestWhitespaceCollapse:
    def test_double_space_collapsed(self):
        result = compress("จอง  วันพรุ่งนี้")
        assert "  " not in result

    def test_leading_trailing_whitespace_stripped(self):
        result = compress("  สอบถาม  ")
        assert result == result.strip()


class TestSafetyAndEdgeCases:
    def test_empty_string_handled(self):
        result = compress("")
        assert isinstance(result, str)

    def test_english_text_unchanged_in_content(self):
        result = compress("Hello, please book at 10am")
        assert "Hello" in result
        assert "book" in result

    def test_core_intent_preserved_after_compression(self):
        # "ขอจองนัดตรวจเลือด พรุ่งนี้ บ่ายสอง ค่ะ" → remove ค่ะ
        result = compress("ขอจองนัดตรวจเลือด พรุ่งนี้ บ่ายสอง ค่ะ")
        assert "จอง" in result
        assert "ตรวจเลือด" in result
        assert "พรุ่งนี้" in result
        assert "ค่ะ" not in result

    def test_no_crash_on_unicode(self):
        result = compress("🏥 จองคิวครับ")
        assert isinstance(result, str)
        assert "จองคิว" in result
