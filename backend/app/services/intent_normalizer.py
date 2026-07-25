"""Blueprint §3.4 — In-flow Intent Normalizer.

Converts short mid-flow Thai responses to a standard label without calling LLM.
Used when the patient is already inside a booking flow and we just need YES/NO/CHANGE/PICK.

Priority (highest wins): CANCEL > MODIFY > CONFIRM > SELECT_N > UNCERTAIN
Destructive / specific signals outrank affirmative ones to avoid misreads
e.g. "ยกเลิกการเปลี่ยน" → CANCEL (not MODIFY).
"""
import re

_THAI_DIGITS = str.maketrans("๐๑๒๓๔๕๖๗๘๙", "0123456789")
_FILLER_RE = re.compile(r"\b(ครับ|ค่ะ|คะ|นะ|นะคะ|นะครับ|จ้า|จ้ะ)\b", re.UNICODE)
_NUM_RE = re.compile(r"^\s*(\d+)\s*$")

_CANCEL_TOKENS = {
    "ยกเลิก", "ไม่เอา", "ไม่ต้องการ", "ไม่", "cancel", "ออก", "หยุด",
    "ไม่ยืนยัน", "ไม่จอง", "เปลี่ยนใจ", "ไม่ต้อง",
}
_MODIFY_TOKENS = {
    "แก้ไข", "เปลี่ยน", "แก้", "modify", "edit", "เปลี่ยนใหม่", "ปรับ", "แก้ใหม่",
}
_CONFIRM_TOKENS = {
    "ใช่", "ยืนยัน", "ตกลง", "โอเค", "ok", "okay", "ได้เลย", "ได้", "เอา",
    "จองเลย", "ต้องการ", "ทำได้เลย", "เลย", "จ้า", "จ้ะ", "โอ", "ใช่แล้ว",
    "ยืนยันครับ", "ยืนยันค่ะ", "ตกลงครับ", "ตกลงค่ะ", "ใช่ครับ", "ใช่ค่ะ",
}


def normalize_in_flow(text: str) -> str:
    """Return one of: CONFIRM | CANCEL | MODIFY | SELECT_<n> | UNCERTAIN.

    Call this before running LLM when patient is already in a booking flow,
    to cheaply handle simple yes/no/change responses.
    """
    cleaned = text.translate(_THAI_DIGITS)
    cleaned = _FILLER_RE.sub("", cleaned).strip().lower()

    # Priority order: CANCEL > MODIFY > CONFIRM
    for token in _CANCEL_TOKENS:
        if token in cleaned:
            return "CANCEL"
    for token in _MODIFY_TOKENS:
        if token in cleaned:
            return "MODIFY"
    for token in _CONFIRM_TOKENS:
        if token in cleaned:
            return "CONFIRM"

    # Numbered list selection
    m = _NUM_RE.match(cleaned)
    if m:
        return f"SELECT_{m.group(1)}"

    return "UNCERTAIN"
