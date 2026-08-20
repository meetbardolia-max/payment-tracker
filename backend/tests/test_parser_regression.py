"""Regression tests for parse_outstanding() correctness against /tmp/outstanding.xlsx.

These validate the fix for user-reported party-total mismatch (esp. J TEX INDIA / PJTX)
where per-row bill_os column contained running-balance artifacts. New parser uses the
`Pty Tot:` row as authoritative and clamps per-bill display outstanding.
"""
import os
import sys
import pytest

sys.path.insert(0, "/app/backend")
from server import parse_outstanding  # noqa: E402

XLSX = "/tmp/outstanding.xlsx"


@pytest.fixture(scope="module")
def parsed():
    with open(XLSX, "rb") as f:
        return parse_outstanding(f.read(), "outstanding.xlsx")


def _by_code(parsed, code):
    for p in parsed["parties"]:
        if (p.get("party_code") or "").upper() == code.upper():
            return p
    raise AssertionError(f"party_code {code} not found")


def test_party_count_and_grand_total(parsed):
    assert parsed["party_count"] == 114, parsed["party_count"]
    # Expected 2,32,59,467 ≈ 23,259,467 — tolerance 1 rupee for rounding.
    assert abs(parsed["total_outstanding"] - 23259467) < 2, parsed["total_outstanding"]


def test_jtex_india_totals_from_pty_tot(parsed):
    p = _by_code(parsed, "PJTX")
    assert p["party_name"].upper().startswith("J TEX INDIA"), p["party_name"]
    assert p["authoritative"] is True
    assert round(p["total_bill_amt"]) == 3545532, p["total_bill_amt"]
    assert round(p["total_received"]) == 21533, p["total_received"]
    assert round(p["total_outstanding"]) == 191702, p["total_outstanding"]


def test_lc_enterprise(parsed):
    p = _by_code(parsed, "PLCE")
    assert round(p["total_outstanding"]) == 1406857, p["total_outstanding"]
    assert p["authoritative"] is True


def test_cb_creation(parsed):
    p = _by_code(parsed, "RCB")
    assert round(p["total_outstanding"]) == 1577032, p["total_outstanding"]


def test_kavya_processors(parsed):
    p = _by_code(parsed, "AKAV")
    assert round(p["total_outstanding"]) == 156082, p["total_outstanding"]


def test_roopam_creation(parsed):
    p = _by_code(parsed, "PROM")
    assert round(p["total_outstanding"]) == 263082, p["total_outstanding"]


def test_all_parties_have_authoritative_flag(parsed):
    # Every party in this workbook should have a Pty Tot row
    non_auth = [p["party_name"] for p in parsed["parties"] if not p.get("authoritative")]
    assert non_auth == [], f"Missing Pty Tot for: {non_auth}"


def test_jtex_15_07_2026_bill_clamped_to_zero(parsed):
    p = _by_code(parsed, "PJTX")
    target = [b for b in p["bills"] if b.get("display_date") == "15/07/2026"]
    assert target, "15/07/2026 bill not found on J TEX INDIA"
    b = target[0]
    assert b["raw_bill_os"] == -1676569 or round(b["raw_bill_os"]) == -1676569, b["raw_bill_os"]
    assert b["bill_os"] == 0, b["bill_os"]


def test_no_negative_bill_os_anywhere(parsed):
    for p in parsed["parties"]:
        for b in p["bills"]:
            assert b["bill_os"] >= 0, (p["party_name"], b["display_date"], b["bill_os"])
