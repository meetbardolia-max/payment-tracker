"""Regression tests for the Bearer-token fallback auth and cheque upload/serve flow.

Focus:
- POST /api/auth/login returns access_token in body plus HttpOnly cookie
- Wrong password returns 401 with no token
- Bearer-only auth works on /auth/me, /dashboard, /snapshots, /officers, /reasons
- Cookie-only auth still works on /auth/me (regression)
- Cheque upload+retrieve via Emergent Object Storage (env-blocked failures are surfaced separately)
- Follow-up creation with all outcomes works with either auth style
- Assignment endpoint works
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to reading frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"
OWNER = {"email": "owner@sripati.local", "password": "Sripati@123"}
HEAD = {"email": "head@sripati.local", "password": "Sripati@123"}
FIELD1 = {"email": "field1@sripati.local", "password": "Sripati@123"}


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def owner_login():
    r = requests.post(f"{API}/auth/login", json=OWNER, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {
        "token": data["access_token"],
        "cookie": r.cookies.get("access_token"),
        "user": data,
        "raw_cookies": r.cookies,
    }


@pytest.fixture(scope="module")
def owner_bearer(owner_login):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {owner_login['token']}"})
    return s


@pytest.fixture(scope="module")
def owner_cookie(owner_login):
    s = requests.Session()
    s.cookies.update(owner_login["raw_cookies"])
    return s


# ---------- auth: login response shape ----------
class TestLoginResponse:
    def test_login_returns_access_token(self):
        r = requests.post(f"{API}/auth/login", json=OWNER, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body and isinstance(body["access_token"], str) and len(body["access_token"]) > 20
        assert body.get("email") == OWNER["email"]
        assert body.get("role") == "owner"
        # cookie also set
        assert r.cookies.get("access_token"), "HttpOnly cookie should still be set"

    def test_login_wrong_password_401_no_token(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": OWNER["email"], "password": "wrong-pass"}, timeout=30)
        assert r.status_code == 401
        assert "access_token" not in r.text.lower() or "incorrect" in r.text.lower()
        assert r.json().get("detail") == "Incorrect email or password"


# ---------- auth: Bearer-only ----------
class TestBearerOnly:
    def test_me_via_bearer(self, owner_bearer):
        r = owner_bearer.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == OWNER["email"]

    def test_dashboard_via_bearer(self, owner_bearer):
        r = owner_bearer.get(f"{API}/dashboard", timeout=30)
        assert r.status_code == 200
        assert "metrics" in r.json()

    def test_snapshots_via_bearer(self, owner_bearer):
        r = owner_bearer.get(f"{API}/snapshots", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_officers_via_bearer(self, owner_bearer):
        r = owner_bearer.get(f"{API}/officers", timeout=30)
        assert r.status_code == 200
        officers = r.json()
        assert isinstance(officers, list)
        assert all(o["role"] == "field_officer" for o in officers)

    def test_reasons_via_bearer(self, owner_bearer):
        r = owner_bearer.get(f"{API}/reasons", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list) and len(r.json()) >= 10

    def test_no_auth_returns_401(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401


# ---------- auth: Cookie-only regression ----------
class TestCookieOnly:
    def test_me_via_cookie(self, owner_cookie):
        # ensure no Authorization header
        r = owner_cookie.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == OWNER["email"]


# ---------- snapshot + assignment + follow-ups (mixing auth styles) ----------
@pytest.fixture(scope="module")
def committed_snapshot(owner_bearer):
    """Upload /tmp/outstanding.xlsx and commit; return snapshot id and party list."""
    with open("/tmp/outstanding.xlsx", "rb") as f:
        r = owner_bearer.post(f"{API}/outstanding/upload",
                              files={"file": ("outstanding.xlsx", f,
                                              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                              timeout=120)
    assert r.status_code == 200, r.text
    parsed = r.json()
    assert parsed["party_count"] == 114

    commit_payload = {
        "parties": parsed["parties"],
        "period_label": "TEST_bearer_snapshot",
        "report_period": parsed.get("report_period", ""),
        "source_file": "outstanding.xlsx",
        "total_outstanding": parsed["total_outstanding"],
        "total_bill_amt": parsed["total_bill_amt"],
        "total_received": parsed["total_received"],
    }
    r = owner_bearer.post(f"{API}/outstanding/commit", json=commit_payload, timeout=60)
    assert r.status_code == 200, r.text
    snap = r.json()
    r2 = owner_bearer.get(f"{API}/snapshots/{snap['id']}/parties", timeout=60)
    assert r2.status_code == 200
    return {"snapshot_id": snap["id"], "parties": r2.json()}


class TestAssignmentAndFollowUps:
    def test_assignment_endpoint(self, owner_bearer, committed_snapshot):
        parties = committed_snapshot["parties"]
        officers = owner_bearer.get(f"{API}/officers").json()
        assert officers, "need at least one field officer"
        officer_id = next(o["id"] for o in officers if o["email"] == FIELD1["email"])
        party_ids = [p["id"] for p in parties[:3]]
        r = owner_bearer.post(f"{API}/assignments",
                              json={"snapshot_id": committed_snapshot["snapshot_id"],
                                    "party_ids": party_ids, "officer_id": officer_id},
                              timeout=30)
        assert r.status_code == 200
        assert r.json()["assigned"] == 3

    @pytest.mark.parametrize("outcome,payload_extra", [
        ("paid_full", {"amount_received": 10000, "payment_method": "cash"}),
        ("paid_partial", {"amount_received": 5000, "remaining_amount": 5000,
                          "reason": "Cash-flow issue"}),
        ("not_paid", {"reason": "Cheque will be issued later"}),
    ])
    def test_followup_creation_bearer(self, owner_bearer, committed_snapshot, outcome, payload_extra):
        party = committed_snapshot["parties"][0]
        payload = {
            "snapshot_id": committed_snapshot["snapshot_id"],
            "party_id": party["id"],
            "outcome": outcome,
            "notes": f"TEST_{outcome}_bearer",
            **payload_extra,
        }
        r = owner_bearer.post(f"{API}/follow-ups", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["outcome"] == outcome

    def test_followup_creation_cookie(self, owner_cookie, committed_snapshot):
        party = committed_snapshot["parties"][1]
        r = owner_cookie.post(f"{API}/follow-ups", json={
            "snapshot_id": committed_snapshot["snapshot_id"],
            "party_id": party["id"],
            "outcome": "paid_full",
            "amount_received": 1000,
            "notes": "TEST_cookie_auth_style",
        }, timeout=30)
        assert r.status_code == 200


# ---------- sort regression ----------
class TestSortRegression:
    @pytest.mark.parametrize("sort", [
        "outstanding_desc", "outstanding_asc",
        "code_asc", "code_desc",
        "name_asc", "name_desc",
    ])
    def test_sort_returns_all_parties(self, owner_bearer, committed_snapshot, sort):
        r = owner_bearer.get(f"{API}/snapshots/{committed_snapshot['snapshot_id']}/parties",
                             params={"sort": sort}, timeout=30)
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) == 114, f"{sort} should return 114 parties, got {len(rows)}"

    def test_name_desc_uses_reverse(self, owner_bearer, committed_snapshot):
        r = owner_bearer.get(f"{API}/snapshots/{committed_snapshot['snapshot_id']}/parties",
                             params={"sort": "name_desc"}, timeout=30)
        rows = r.json()
        names = [(p.get("party_name") or "").upper() for p in rows]
        assert names == sorted(names, reverse=True), \
            f"name_desc should be reverse alphabetical; first 5: {names[:5]}"

    def test_code_desc_empty_sink(self, owner_bearer, committed_snapshot):
        r = owner_bearer.get(f"{API}/snapshots/{committed_snapshot['snapshot_id']}/parties",
                             params={"sort": "code_desc"}, timeout=30)
        rows = r.json()
        codes = [(p.get("party_code") or "") for p in rows]
        # find split point: all non-empty then all empty
        first_empty = next((i for i, c in enumerate(codes) if not c), len(codes))
        assert all(codes[i] for i in range(first_empty)), "empty codes should be at the bottom"
        assert all(not codes[i] for i in range(first_empty, len(codes)))


# ---------- parser regression ----------
class TestParserSanity:
    def test_party_totals(self, committed_snapshot):
        parties = committed_snapshot["parties"]
        by_name = {p["party_name"].upper(): p for p in parties}
        # J TEX INDIA
        jtex = next((v for k, v in by_name.items() if "J TEX INDIA" in k), None)
        assert jtex and abs(jtex["total_outstanding"] - 191702) < 5, jtex and jtex["total_outstanding"]
        # C.B. CREATION
        cbc = next((v for k, v in by_name.items() if "C.B. CREATION" in k), None)
        assert cbc and abs(cbc["total_outstanding"] - 1577032) < 5, cbc and cbc["total_outstanding"]
        assert len(parties) == 114
        total = sum(p["total_outstanding"] for p in parties)
        assert abs(total - 23259467) < 1000, total


# ---------- cheque upload/serve (Emergent Object Storage) ----------
class TestChequeFlow:
    def test_cheque_upload_and_retrieve(self, owner_bearer, owner_cookie):
        with open("/tmp/cheque_test.png", "rb") as f:
            r = owner_bearer.post(f"{API}/follow-ups/cheque",
                                  files={"file": ("test.png", f, "image/png")}, timeout=60)
        if r.status_code == 503:
            pytest.skip(f"Object storage unreachable from test harness: {r.text}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and body["url"].startswith("/api/uploads/cheques/")
        assert "filename" in body and "storage_path" in body

        filename = body["filename"]

        # Serve via bearer
        r2 = owner_bearer.get(f"{API}/uploads/cheques/{filename}", timeout=60)
        assert r2.status_code == 200
        assert r2.content and len(r2.content) > 0
        assert r2.headers.get("content-type", "").startswith("image/")

        # Serve via cookie regression
        r3 = owner_cookie.get(f"{API}/uploads/cheques/{filename}", timeout=60)
        assert r3.status_code == 200
        assert r3.content == r2.content

    def test_cheque_upload_rejects_non_image(self, owner_bearer):
        r = owner_bearer.post(f"{API}/follow-ups/cheque",
                              files={"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")},
                              timeout=30)
        assert r.status_code == 400
