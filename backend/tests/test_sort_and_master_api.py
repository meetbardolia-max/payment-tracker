"""Sort dropdown regression on /api/snapshots/{id}/parties.

Assumes a snapshot has been committed (module fixtures in test_sripati_api.py do this
in the same session). Uses head officer session to bypass field-officer scoping so we
see all 114 parties.
"""
import os
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
XLSX = "/tmp/outstanding.xlsx"


@pytest.fixture(scope="module")
def head_and_snap():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": "head@sripati.local", "password": "Sripati@123"})
    assert r.status_code == 200

    active = s.get(f"{BASE_URL}/api/snapshots/active")
    if active.status_code != 200 or not active.json():
        with open(XLSX, "rb") as f:
            content = f.read()
        up = s.post(
            f"{BASE_URL}/api/outstanding/upload",
            files={"file": ("outstanding.xlsx", content,
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert up.status_code == 200, up.text
        pv = up.json()
        c = s.post(f"{BASE_URL}/api/outstanding/commit", json={
            "parties": pv["parties"], "period_label": "Sort Test",
            "report_period": pv.get("report_period", ""),
            "source_file": pv["source_file"],
            "total_outstanding": pv["total_outstanding"],
            "total_bill_amt": pv["total_bill_amt"],
            "total_received": pv["total_received"],
        })
        assert c.status_code == 200
        snap = c.json()
    else:
        snap = active.json()
    return s, snap["id"]


def _fetch(session, sid, sort):
    r = session.get(f"{BASE_URL}/api/snapshots/{sid}/parties",
                    params={"sort": sort})
    assert r.status_code == 200
    return r.json()


def test_outstanding_desc(head_and_snap):
    s, sid = head_and_snap
    rows = _fetch(s, sid, "outstanding_desc")
    vals = [p["total_outstanding"] for p in rows]
    assert vals == sorted(vals, reverse=True)


def test_outstanding_asc(head_and_snap):
    s, sid = head_and_snap
    rows = _fetch(s, sid, "outstanding_asc")
    vals = [p["total_outstanding"] for p in rows]
    assert vals == sorted(vals)


def test_name_asc_and_desc(head_and_snap):
    s, sid = head_and_snap
    asc = [p["party_name"].upper() for p in _fetch(s, sid, "name_asc")]
    assert asc == sorted(asc)
    desc = [p["party_name"].upper() for p in _fetch(s, sid, "name_desc")]
    assert desc == sorted(desc, reverse=True)


def test_code_asc_sinks_empty_to_end(head_and_snap):
    s, sid = head_and_snap
    rows = _fetch(s, sid, "code_asc")
    codes = [(p.get("party_code") or "") for p in rows]
    # non-empty first, then empties
    nonempty = [c for c in codes if c]
    empties = [c for c in codes if not c]
    assert codes == nonempty + empties
    assert [c.upper() for c in nonempty] == sorted(c.upper() for c in nonempty)


def test_code_desc_also_sinks_empty_to_end(head_and_snap):
    s, sid = head_and_snap
    rows = _fetch(s, sid, "code_desc")
    codes = [(p.get("party_code") or "") for p in rows]
    nonempty = [c for c in codes if c]
    empties = [c for c in codes if not c]
    assert codes == nonempty + empties, "empty party_codes must be at the end for code_desc too"
    assert [c.upper() for c in nonempty] == sorted((c.upper() for c in nonempty), reverse=True)


def test_master_view_returns_all_parties_no_truncation(head_and_snap):
    s, sid = head_and_snap
    groups = s.get(f"{BASE_URL}/api/snapshots/{sid}/parties",
                   params={"view": "master"}).json()
    total_party_count = sum(g["party_count"] for g in groups)
    total_in_lists = sum(len(g["parties"]) for g in groups)
    assert total_party_count == total_in_lists  # no slicing
    for g in groups:
        assert len(g["parties"]) == g["party_count"], g["master"]


def test_bhupendra_master_has_98_parties(head_and_snap):
    s, sid = head_and_snap
    groups = s.get(f"{BASE_URL}/api/snapshots/{sid}/parties",
                   params={"view": "master"}).json()
    bh = next((g for g in groups if "BHUPENDRA" in g["master"].upper()), None)
    assert bh is not None, [g["master"] for g in groups]
    assert bh["party_count"] == 98, bh["party_count"]
    assert len(bh["parties"]) == 98


def test_authoritative_flag_present_on_committed_party(head_and_snap):
    s, sid = head_and_snap
    parties = s.get(f"{BASE_URL}/api/snapshots/{sid}/parties").json()
    jtex = next((p for p in parties if (p.get("party_code") or "").upper() == "PJTX"), None)
    assert jtex is not None
    # detail endpoint should surface authoritative + bills with clamped bill_os
    detail = s.get(f"{BASE_URL}/api/parties/{jtex['id']}").json()
    assert detail.get("authoritative") is True
    for b in detail["bills"]:
        assert b["bill_os"] >= 0
    # Verify J TEX 15/07/2026 bill: raw negative, clamped to 0
    target = [b for b in detail["bills"] if b.get("display_date") == "15/07/2026"]
    assert target
    assert target[0]["bill_os"] == 0
    assert target[0]["raw_bill_os"] < 0
