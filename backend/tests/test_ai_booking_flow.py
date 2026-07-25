"""Golden tests for the booking flow reasoning engine (decide()) and helpers.

These tests NEVER hit DB or LLM — they validate the pure decision logic.
Any new business rule added to decide() must have a golden test here first.
"""
import pytest

from app.services.booking_flow import decide, ReasoningDecision, _get_coverage_options
from app.services.thai_optimizer import bypass_extract, compress, _resolve_time, _resolve_date
from app.services.intent_normalizer import normalize_in_flow

from datetime import date

# ── Fixtures ──────────────────────────────────────────────────────────────────

FULL_SLOTS = {
    "09:00": {"capacity": 2, "reserved": 0},
    "10:00": {"capacity": 2, "reserved": 0},
    "14:00": {"capacity": 2, "reserved": 0},
}
FULL_SLOTS_ALL_TAKEN = {
    "09:00": {"capacity": 2, "reserved": 2},
    "10:00": {"capacity": 2, "reserved": 2},
}
PARTIAL_SLOTS = {
    "09:00": {"capacity": 2, "reserved": 2},  # full
    "10:00": {"capacity": 2, "reserved": 1},  # available
}
SERVICES = [
    {"id": "svc-1", "name": "ตรวจทั่วไป", "deposit_amount": 0},
    {"id": "svc-2", "name": "ตรวจเลือด", "deposit_amount": 100},
]
CLINIC = {
    "sso_enabled": True,
    "universal_enabled": True,
}


# ── decide() golden tests ─────────────────────────────────────────────────────

class TestDecide:
    def test_no_date_returns_ask_date(self):
        d = decide({}, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "ask_date"

    def test_date_no_time_returns_ask_time_with_available(self):
        bk = {"date": "2026-07-26"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "ask_time"
        assert "09:00" in d.available_slots
        assert "10:00" in d.available_slots

    def test_all_slots_full_returns_no_slots(self):
        bk = {"date": "2026-07-26"}
        d = decide(bk, FULL_SLOTS_ALL_TAKEN, SERVICES, CLINIC)
        assert d.action == "no_slots"

    def test_time_full_returns_slot_full_with_alternatives(self):
        bk = {"date": "2026-07-26", "time": "09:00"}
        d = decide(bk, PARTIAL_SLOTS, SERVICES, CLINIC)
        assert d.action == "slot_full"
        assert "10:00" in d.available_slots
        assert "09:00" not in d.available_slots

    def test_date_time_no_service_returns_ask_service(self):
        bk = {"date": "2026-07-26", "time": "09:00"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "ask_service"
        assert len(d.services) == 2

    def test_skips_service_step_when_no_services_configured(self):
        bk = {"date": "2026-07-26", "time": "09:00"}
        d = decide(bk, FULL_SLOTS, [], CLINIC)  # empty services list
        assert d.action == "ask_coverage"

    def test_date_time_service_no_coverage_returns_ask_coverage(self):
        bk = {"date": "2026-07-26", "time": "09:00",
              "service_id": "svc-1", "service_name": "ตรวจทั่วไป"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "ask_coverage"
        assert "cash" in d.coverage_options
        assert "sso" in d.coverage_options

    def test_coverage_options_disabled_sso(self):
        bk = {"date": "2026-07-26", "time": "09:00",
              "service_id": "svc-1", "service_name": "ตรวจทั่วไป"}
        clinic_no_sso = {"sso_enabled": False, "universal_enabled": True}
        d = decide(bk, FULL_SLOTS, SERVICES, clinic_no_sso)
        assert d.action == "ask_coverage"
        assert "sso" not in d.coverage_options
        assert "cash" in d.coverage_options

    def test_missing_name_returns_ask_name(self):
        bk = {"date": "2026-07-26", "time": "09:00",
              "service_id": "svc-1", "service_name": "ตรวจทั่วไป",
              "coverage": "cash"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "ask_name"

    def test_missing_phone_returns_ask_phone(self):
        bk = {"date": "2026-07-26", "time": "09:00",
              "service_id": "svc-1", "service_name": "ตรวจทั่วไป",
              "coverage": "cash", "patient_name": "สมชาย"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "ask_phone"

    def test_all_fields_returns_confirm(self):
        bk = {"date": "2026-07-26", "time": "09:00",
              "service_id": "svc-1", "service_name": "ตรวจทั่วไป",
              "coverage": "cash", "patient_name": "สมชาย",
              "phone": "0812345678"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.action == "confirm"

    def test_slots_sorted_ascending(self):
        bk = {"date": "2026-07-26"}
        d = decide(bk, FULL_SLOTS, SERVICES, CLINIC)
        assert d.available_slots == sorted(d.available_slots)


# ── Thai optimizer tests ──────────────────────────────────────────────────────

class TestThaiOptimizer:
    today = date(2026, 7, 25)  # Saturday

    def test_compress_removes_filler(self):
        assert "จอง" in compress("จองครับ")
        assert "ครับ" not in compress("จองครับ")

    def test_compress_normalizes_thai_digits(self):
        assert "09" in compress("๐๙")

    def test_bypass_resolves_tomorrow(self):
        result = bypass_extract("จองพรุ่งนี้", self.today)
        assert result["date"] == "2026-07-26"

    def test_bypass_resolves_today(self):
        result = bypass_extract("วันนี้", self.today)
        assert result["date"] == str(self.today)

    def test_bypass_resolves_thai_time(self):
        result = bypass_extract("บ่ายสอง", self.today)
        assert result["time"] == "14:00"

    def test_bypass_resolves_nine_am(self):
        result = bypass_extract("เก้าโมงเช้า", self.today)
        assert result["time"] == "09:00"

    def test_bypass_resolves_24h_time(self):
        result = bypass_extract("เวลา 09:30", self.today)
        assert result["time"] == "09:30"

    def test_bypass_resolves_next_monday(self):
        result = bypass_extract("วันจันทร์", self.today)  # today is Sat → next Mon
        assert result["date"] == "2026-07-27"

    def test_bypass_empty_on_no_match(self):
        result = bypass_extract("ขอถามเรื่องราคา", self.today)
        assert result == {}

    def test_bypass_resolves_date_slash_format(self):
        result = bypass_extract("28/7", self.today)
        assert result["date"] == "2026-07-28"


# ── Intent normalizer tests ───────────────────────────────────────────────────

class TestIntentNormalizer:
    def test_confirm_yes(self):
        assert normalize_in_flow("ยืนยัน") == "CONFIRM"

    def test_confirm_ok(self):
        assert normalize_in_flow("โอเค") == "CONFIRM"

    def test_cancel_wins_over_modify(self):
        assert normalize_in_flow("ยกเลิกการเปลี่ยน") == "CANCEL"

    def test_cancel(self):
        assert normalize_in_flow("ไม่เอา") == "CANCEL"

    def test_modify(self):
        assert normalize_in_flow("เปลี่ยนวัน") == "MODIFY"

    def test_number_select(self):
        assert normalize_in_flow("2") == "SELECT_2"
        assert normalize_in_flow("1") == "SELECT_1"

    def test_thai_digit_select(self):
        assert normalize_in_flow("๓") == "SELECT_3"

    def test_uncertain(self):
        assert normalize_in_flow("สมชาย") == "UNCERTAIN"

    def test_confirm_with_filler(self):
        assert normalize_in_flow("ยืนยันครับ") == "CONFIRM"

    def test_cancel_with_filler(self):
        assert normalize_in_flow("ยกเลิกค่ะ") == "CANCEL"
