"""Blueprint §2 — 3-Layer Token Reduction.

Layer 1 - Bypass: resolve Thai time/date expressions to structured values without LLM.
Layer 2 - Compress: strip filler words, normalize Thai numerals, collapse whitespace.
Layer 3 - Optimized prompt: English system prompt + JSON mode (enforced at call sites).

Thai numeric expressions are resolved by lookup tables — faster and more accurate than LLM
for fixed-vocabulary terms, and avoids LLM errors on Buddhist Era year / timezone guessing.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Optional

# ── Layer 1: Bypass tables ───────────────────────────────────────────────────

_THAI_TIMES: dict[str, str] = {
    # midnight / early morning
    "เที่ยงคืน": "00:00",
    "ตีหนึ่ง": "01:00", "ตีสอง": "02:00", "ตีสาม": "03:00",
    "ตีสี่": "04:00", "ตีห้า": "05:00",
    # morning
    "หกโมงเช้า": "06:00", "หกโมง": "06:00",
    "เจ็ดโมงเช้า": "07:00", "เจ็ดโมง": "07:00",
    "แปดโมงเช้า": "08:00", "แปดโมง": "08:00",
    "เก้าโมงเช้า": "09:00", "เก้าโมง": "09:00",
    "สิบโมงเช้า": "10:00", "สิบโมง": "10:00",
    "สิบเอ็ดโมงเช้า": "11:00", "สิบเอ็ดโมง": "11:00",
    # noon
    "เที่ยง": "12:00", "สิบสองโมง": "12:00", "เที่ยงวัน": "12:00",
    # afternoon (บ่าย)
    "บ่ายโมง": "13:00", "บ่ายหนึ่ง": "13:00", "สิบสามนาฬิกา": "13:00",
    "บ่ายสอง": "14:00", "สิบสี่นาฬิกา": "14:00",
    "บ่ายสาม": "15:00", "สิบห้านาฬิกา": "15:00",
    "บ่ายสี่": "16:00", "สิบหกนาฬิกา": "16:00",
    "บ่ายห้า": "17:00", "ห้าโมงเย็น": "17:00", "สิบเจ็ดนาฬิกา": "17:00",
    # evening
    "หกโมงเย็น": "18:00", "สิบแปดนาฬิกา": "18:00",
    "เจ็ดโมงเย็น": "19:00", "สิบเก้านาฬิกา": "19:00",
    "แปดโมงเย็น": "20:00", "ยี่สิบนาฬิกา": "20:00",
    "เก้าโมงเย็น": "21:00", "ยี่สิบเอ็ดนาฬิกา": "21:00",
    "สิบโมงเย็น": "22:00", "ยี่สิบสองนาฬิกา": "22:00",
    "สิบเอ็ดโมงเย็น": "23:00", "ยี่สิบสามนาฬิกา": "23:00",
    # half-hours
    "หกโมงครึ่ง": "06:30", "เจ็ดโมงครึ่ง": "07:30",
    "แปดโมงครึ่ง": "08:30", "เก้าโมงครึ่ง": "09:30",
    "สิบโมงครึ่ง": "10:30", "สิบเอ็ดโมงครึ่ง": "11:30",
    "บ่ายโมงครึ่ง": "13:30", "บ่ายสองครึ่ง": "14:30",
    "บ่ายสามครึ่ง": "15:30", "บ่ายสี่ครึ่ง": "16:30",
    "ห้าโมงครึ่ง": "17:30",
}

_RELATIVE_DATES: dict[str, int] = {
    "วันนี้": 0, "today": 0,
    "พรุ่งนี้": 1, "พรุ่ง": 1, "tomorrow": 1,
    "มะรืนนี้": 2, "มะรืน": 2,
}

_THAI_WEEKDAYS: dict[str, int] = {
    "วันจันทร์": 0, "จันทร์": 0,
    "วันอังคาร": 1, "อังคาร": 1,
    "วันพุธ": 2, "พุธ": 2,
    "วันพฤหัสบดี": 3, "วันพฤหัส": 3, "พฤหัส": 3, "พฤหัสบดี": 3,
    "วันศุกร์": 4, "ศุกร์": 4,
    "วันเสาร์": 5, "เสาร์": 5,
    "วันอาทิตย์": 6, "อาทิตย์": 6,
}

# ── Layer 2: Compression ─────────────────────────────────────────────────────

# Thai script has no spaces between syllables so \w lookbehind doesn't help.
# These particles are safe to strip anywhere they appear — they carry no semantic intent.
_FILLER_RE = re.compile(
    r"ขอบคุณครับ|ขอบคุณค่ะ|ด้วยนะครับ|ด้วยนะคะ|ด้วยครับ|ด้วยค่ะ"
    r"|นะครับ|นะคะ|นะจ้า|หน่อยนะ|ครับ|ค่ะ|คะ|จ้า|จ้ะ|หน่อย|ขอบคุณ|กรุณา|โปรด",
    re.UNICODE,
)

_THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")

# Regex patterns for time extraction
_TIME_24H_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")
_BAAI_RE = re.compile(r"บ่าย\s*(\d{1,2})")
_HOUR_MOONG_RE = re.compile(r"(\d{1,2})\s*โมง(?:เช้า|เย็น)?")


def compress(text: str) -> str:
    """Strip filler words, normalize Thai numerals, collapse whitespace. ~20-35% token savings."""
    text = text.translate(_THAI_DIGITS)
    text = _FILLER_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _next_weekday(today: date, wd: int) -> date:
    """Return the next occurrence of weekday wd (Mon=0) strictly after today."""
    days_ahead = wd - today.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return today + timedelta(days=days_ahead)


def _resolve_time(text: str) -> Optional[str]:
    """Extract a time string (HH:MM) from text. Tries table first, then patterns."""
    # Table lookup (longest match first)
    for expr, t in sorted(_THAI_TIMES.items(), key=lambda x: -len(x[0])):
        if expr in text:
            return t
    # HH:MM literal
    m = _TIME_24H_RE.search(text)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}"
    # บ่าย X → (X+12):00  (บ่าย 2 = 14:00)
    m = _BAAI_RE.search(text)
    if m:
        h = int(m.group(1)) + 12
        if 13 <= h <= 17:
            return f"{h:02d}:00"
    # X โมง (morning context, 1–11)
    m = _HOUR_MOONG_RE.search(text)
    if m:
        h = int(m.group(1))
        if 1 <= h <= 11:
            return f"{h:02d}:00"
    return None


def _resolve_date(text: str, today: date) -> Optional[str]:
    """Extract a date (YYYY-MM-DD) from text. Returns None if not resolvable."""
    # Relative offsets
    for expr, offset in sorted(_RELATIVE_DATES.items(), key=lambda x: -len(x[0])):
        if expr in text:
            return str(today + timedelta(days=offset))
    # Weekdays
    next_week = "สัปดาห์หน้า" in text or ("หน้า" in text and any(d in text for d in _THAI_WEEKDAYS))
    for expr, wd in sorted(_THAI_WEEKDAYS.items(), key=lambda x: -len(x[0])):
        if expr in text:
            target = _next_weekday(today, wd)
            if next_week:
                target += timedelta(days=7)
            return str(target)
    # ISO YYYY-MM-DD
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if m:
        return m.group(0)
    # D/M or D/M/Y (Thai date format)
    m = re.search(r"\b(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\b", text)
    if m:
        day, month = int(m.group(1)), int(m.group(2))
        year = int(m.group(3)) if m.group(3) else today.year
        if year < 100:
            year += 2000
        if year > 2400:  # Buddhist Era → Gregorian
            year -= 543
        try:
            return str(date(year, month, day))
        except ValueError:
            pass
    return None


def bypass_extract(text: str, today: date) -> dict:
    """Layer 1: Try to extract date and/or time without calling LLM.

    Returns a partial dict with "date" and/or "time" keys.
    Empty dict = bypass found nothing — fall through to LLM (Layer 3).
    """
    compressed = compress(text)
    result: dict = {}
    d = _resolve_date(compressed, today)
    if d:
        result["date"] = d
    t = _resolve_time(compressed)
    if t:
        result["time"] = t
    return result
