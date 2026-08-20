"""Sripati Collection Desk – backend regression suite (post-pivot to outstanding snapshots)."""
import io
import os
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
XLSX_PATH = "/tmp/outstanding.xlsx"


def _login(email, password="Sripati@123"):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return s, r


@pytest.fixture(scope="module")
def owner_session():
    s, _ = _login("owner@sripati.local")
    return s


@pytest.fixture(scope="module")
def head_session():
    s, _ = _login("head@sripati.local")
    return s


@pytest.fixture(scope="module")
def field1_session():
    s, _ = _login("field1@sripati.local")
    return s


@pytest.fixture(scope="module")
def committed_snapshot(head_session):
    """Upload + commit /tmp/outstanding.xlsx once and reuse across tests."""
    with open(XLSX_PATH, "rb") as f:
        content = f.read()
    r = head_session.post(
        f"{BASE_URL}/api/outstanding/upload",
        files={"file": ("outstanding.xlsx", content,
                         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert r.status_code == 200, r.text
    preview = r.json()
    assert preview["party_count"] > 0
    assert preview["total_outstanding"] > 0
    assert preview["total_bill_amt"] > 0

    payload = {
        "parties": preview["parties"],
        "period_label": "Test Snapshot",
        "report_period": preview.get("report_period", ""),
        "source_file": preview["source_file"],
        "total_outstanding": preview["total_outstanding"],
        "total_bill_amt": preview["total_bill_amt"],
        "total_received": preview["total_received"],
    }
    c = head_session.post(f"{BASE_URL}/api/outstanding/commit", json=payload)
    assert c.status_code == 200, c.text
    snap = c.json()
    return {"snapshot": snap, "preview": preview}


# ---------------- Auth ---------------- #
def test_login_sets_httponly_cookie_and_returns_user():
    s, r = _login("owner@sripati.local")
    body = r.json()
    assert body["email"] == "owner@sripati.local"
    assert body["role"] == "owner"
    assert "password_hash" not in body
    cookie = next(c for c in s.cookies if c.name == "access_token")
    # cookielib stores HttpOnly in _rest
    assert any(k.lower() == "httponly" for k in cookie._rest.keys())
    assert s.get(f"{BASE_URL}/api/auth/me").status_code == 200
    assert s.post(f"{BASE_URL}/api/auth/logout").status_code == 200
    assert s.get(f"{BASE_URL}/api/auth/me").status_code == 401


def test_login_bad_password_returns_401():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "owner@sripati.local", "password": "wrong"})
    assert r.status_code == 401


def test_reasons_returns_13_items(owner_session):
    r = owner_session.get(f"{BASE_URL}/api/reasons")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 13
    assert "Other" in data


# ---------------- Upload / Commit ---------------- #
def test_upload_and_commit_snapshot(committed_snapshot, head_session):
    snap = committed_snapshot["snapshot"]
    assert snap["active"] is True
    assert snap["party_count"] > 0
    # active endpoint returns THIS snapshot
    a = head_session.get(f"{BASE_URL}/api/snapshots/active").json()
    assert a["id"] == snap["id"]


def test_upload_rejects_non_xlsx(head_session):
    r = head_session.post(f"{BASE_URL}/api/outstanding/upload",
                          files={"file": ("bad.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_field_officer_forbidden_from_upload(field1_session):
    r = field1_session.post(f"{BASE_URL}/api/outstanding/upload",
                             files={"file": ("x.xlsx", b"PK\x03\x04",
                                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert r.status_code == 403


def test_field_officer_forbidden_from_commit(field1_session):
    r = field1_session.post(f"{BASE_URL}/api/outstanding/commit",
                             json={"parties": [{"id": "x", "party_name": "Y", "total_outstanding": 0,
                                                 "total_bill_amt": 0, "total_received": 0, "bill_count": 0,
                                                 "bills": []}]})
    assert r.status_code == 403


def test_field_officer_forbidden_from_assignments(field1_session, committed_snapshot):
    r = field1_session.post(f"{BASE_URL}/api/assignments",
                             json={"snapshot_id": committed_snapshot["snapshot"]["id"],
                                   "party_ids": [], "officer_id": "x"})
    assert r.status_code == 403


# ---------------- Snapshots + Parties ---------------- #
def test_snapshots_list_and_previous_deactivated(head_session, committed_snapshot):
    snaps = head_session.get(f"{BASE_URL}/api/snapshots").json()
    assert isinstance(snaps, list) and len(snaps) >= 1
    active_ids = [s["id"] for s in snaps if s["active"]]
    assert active_ids == [committed_snapshot["snapshot"]["id"]]


def test_parties_party_view_sorted_desc(head_session, committed_snapshot):
    sid = committed_snapshot["snapshot"]["id"]
    rows = head_session.get(f"{BASE_URL}/api/snapshots/{sid}/parties").json()
    assert isinstance(rows, list) and len(rows) > 0
    assert rows == sorted(rows, key=lambda x: x["total_outstanding"], reverse=True)
    assert "bills" not in rows[0]


def test_parties_master_view_aggregates(head_session, committed_snapshot):
    sid = committed_snapshot["snapshot"]["id"]
    groups = head_session.get(f"{BASE_URL}/api/snapshots/{sid}/parties",
                               params={"view": "master"}).json()
    assert isinstance(groups, list) and len(groups) > 0
    assert "master" in groups[0] and "total_outstanding" in groups[0]
    assert groups[0]["party_count"] == len(groups[0]["parties"])


# ---------------- Assignments + Field officer scoping ---------------- #
@pytest.fixture(scope="module")
def assigned_field1(head_session, committed_snapshot):
    sid = committed_snapshot["snapshot"]["id"]
    officers = head_session.get(f"{BASE_URL}/api/officers").json()
    field1 = next(o for o in officers if o["email"] == "field1@sripati.local")
    parties = head_session.get(f"{BASE_URL}/api/snapshots/{sid}/parties").json()
    assigned_ids = [p["id"] for p in parties[:3]]
    unassigned_id = parties[-1]["id"]
    r = head_session.post(f"{BASE_URL}/api/assignments",
                           json={"snapshot_id": sid, "party_ids": assigned_ids,
                                 "officer_id": field1["id"]})
    assert r.status_code == 200 and r.json()["assigned"] == 3
    return {"snapshot_id": sid, "officer": field1,
            "assigned_ids": assigned_ids, "unassigned_id": unassigned_id}


def test_field_officer_only_sees_assigned_parties(field1_session, assigned_field1):
    sid = assigned_field1["snapshot_id"]
    rows = field1_session.get(f"{BASE_URL}/api/snapshots/{sid}/parties").json()
    ids = {r["id"] for r in rows}
    assert ids == set(assigned_field1["assigned_ids"])


def test_field_officer_403_on_unassigned_party(field1_session, assigned_field1):
    r = field1_session.get(f"{BASE_URL}/api/parties/{assigned_field1['unassigned_id']}")
    assert r.status_code == 403


def test_field_officer_can_open_assigned_party(field1_session, assigned_field1):
    r = field1_session.get(f"{BASE_URL}/api/parties/{assigned_field1['assigned_ids'][0]}")
    assert r.status_code == 200
    assert r.json()["id"] == assigned_field1["assigned_ids"][0]


# ---------------- Follow-ups (all 3 outcomes) ---------------- #
def test_follow_up_paid_full(field1_session, assigned_field1):
    pid = assigned_field1["assigned_ids"][0]
    sid = assigned_field1["snapshot_id"]
    r = field1_session.post(f"{BASE_URL}/api/follow-ups", json={
        "snapshot_id": sid, "party_id": pid, "outcome": "paid_full",
        "amount_received": 50000, "payment_method": "cash",
        "notes": "settled",
    })
    assert r.status_code == 200
    assert r.json()["outcome"] == "paid_full"


def test_follow_up_paid_partial_with_reason_other(field1_session, assigned_field1):
    pid = assigned_field1["assigned_ids"][1]
    sid = assigned_field1["snapshot_id"]
    r = field1_session.post(f"{BASE_URL}/api/follow-ups", json={
        "snapshot_id": sid, "party_id": pid, "outcome": "paid_partial",
        "amount_received": 10000, "remaining_amount": 15000,
        "reason": "Other", "reason_other": "Custom reason X",
        "promise_date": (date.today() + timedelta(days=7)).isoformat(),
        "promise_amount": 15000,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["reason"] == "Custom reason X"
    assert body["promise_status"] == "Open"


def test_follow_up_not_paid_with_past_promise_creates_broken(field1_session, assigned_field1):
    pid = assigned_field1["assigned_ids"][2]
    sid = assigned_field1["snapshot_id"]
    past = (date.today() - timedelta(days=3)).isoformat()
    today_iso = date.today().isoformat()
    r = field1_session.post(f"{BASE_URL}/api/follow-ups", json={
        "snapshot_id": sid, "party_id": pid, "outcome": "not_paid",
        "reason": "Cash-flow issue",
        "promise_date": past, "promise_amount": 5000,
        "next_followup_date": today_iso,
    })
    assert r.status_code == 200
    # Broken promise reflected on dashboard
    dash = field1_session.get(f"{BASE_URL}/api/dashboard").json()
    assert dash["metrics"]["broken_promise_count"] >= 1
    assert dash["metrics"]["due_today_count"] >= 1


def test_follow_ups_scoped_for_field_officer(field1_session):
    rows = field1_session.get(f"{BASE_URL}/api/follow-ups").json()
    assert all(f["officer_id"] for f in rows)


# ---------------- Cheque upload ---------------- #
def test_cheque_upload_and_serve(field1_session):
    # 1x1 PNG
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
           b"\xc0\x00\x00\x00\x03\x00\x01\x1e\xbd\xf3\xdd\x00\x00\x00\x00IEND\xaeB`\x82")
    r = field1_session.post(f"{BASE_URL}/api/follow-ups/cheque",
                             files={"file": ("cheque.png", png, "image/png")})
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    fname = r.json()["filename"]
    assert url.endswith(fname)
    # auth required
    anon = requests.get(f"{BASE_URL}{url}")
    assert anon.status_code == 401
    # authed serve
    served = field1_session.get(f"{BASE_URL}{url}")
    assert served.status_code == 200
    assert served.headers.get("content-type", "").startswith("image/")


# ---------------- Dashboard + Reports ---------------- #
def test_owner_dashboard_metrics(owner_session, committed_snapshot):
    d = owner_session.get(f"{BASE_URL}/api/dashboard").json()
    assert d["snapshot"]["id"] == committed_snapshot["snapshot"]["id"]
    m = d["metrics"]
    assert m["total_outstanding"] > 0
    assert m["party_count"] > 0
    assert "officer_performance" in d
    assert isinstance(d["officer_performance"], list)


def test_reports_owner_ok_field_forbidden(owner_session, field1_session):
    r = owner_session.get(f"{BASE_URL}/api/reports")
    assert r.status_code == 200
    body = r.json()
    for k in ("snapshots", "follow_ups", "audit"):
        assert k in body
    assert field1_session.get(f"{BASE_URL}/api/reports").status_code == 403
