# Sripati Processors Collection Desk — PRD

## Original problem statement
Fabric-dyeing mill collection-management app. **Pivoted from dispatch/PDF import to Monthly Outstanding Report (Excel) intake.**
Head Operator uploads the monthly Masterwise Groupwise Partywise Outstanding Report (.xlsx).
System displays outstanding amounts Party-wise and Master-wise.
Officers see all/assigned parties, record follow-ups with outcomes:
- Paid Full (method, cheque details/image)
- Paid Partial (amount received, remaining, reason, next follow-up, cheque)
- Not Paid (preloaded reason + Other free text, next follow-up, promise-to-pay date/amount)
Each upload is preserved as an immutable snapshot to keep history.
Track which officer handled each follow-up.

## User personas
- **Owner / Admin**: full oversight, dashboards, reports, audit trail
- **Head Collection Officer**: uploads snapshot, assigns/reassigns parties to 3 field officers, monitors follow-ups
- **Field Collection Officer (x3)**: sees only assigned parties, records collection outcomes, uploads cheque images

## Core static requirements
- JWT auth (HttpOnly cookie), role-based access control
- Excel parser tolerant of the SP outstanding workbook layout (Master/Group/Party grouping, Mth/Pty/Grp/Mst subtotals ignored)
- Bill periods bucketed 1-15 and 16-31 automatically from date column
- Immutable snapshots; only the newest is `active` and drives the workspace
- Follow-up history stays visible even after new snapshot uploads (queried by `party_id`)
- Cheque images stored on disk under `/app/uploads/cheques`, served via `/api/uploads/cheques/{filename}` (auth-gated)
- Broken-promise detection: any follow-up with `promise_date < today` and no subsequent `paid_full` for the same party
- Audit log for login, snapshot commit, follow-up create, assignment

## Implemented (Feb 2026)
- Auth: `/api/auth/{login,logout,me}` with bcrypt + JWT, seeded demo users (see `/app/memory/test_credentials.md`)
- Excel intake: `POST /api/outstanding/upload` (preview) + `POST /api/outstanding/commit` (activate snapshot)
- Snapshots: `GET /api/snapshots`, `GET /api/snapshots/active`, `GET /api/snapshots/{id}/parties?view=party|master`
- Party detail: `GET /api/parties/{id}` (includes follow-up timeline)
- Follow-ups: `POST /api/follow-ups`, cheque upload `POST /api/follow-ups/cheque`, list `GET /api/follow-ups`
- Assignments: `POST /api/assignments` (head/owner)
- Dashboard: `GET /api/dashboard` (role-aware)
- Reports: `GET /api/reports` (owner/head only)
- Frontend: React shell + role-based nav, Dashboard, Outstanding workspace (party/master toggle + drawer), Upload, Snapshots history, Follow-ups list, Reports (CSV export)

## Prioritized backlog
### P0 (next up)
- Enforce force-password-change flow for first login
- Server-side JWT logout invalidation / token blacklist
- Notifications / reminders (in-app bell for follow-ups due today, broken promises)

### P1
- Emergent Object Storage for cheque images (currently local disk)
- Ageing buckets (>7 / >15 / >30 / >60 days) based on oldest bill date
- Reassignment with rationale + audit
- Party contact expansion (primary / accounts / owner) + WhatsApp deep-link
- Export PDFs (per-party statement)

### P2
- Accounts role for payment verification / reconciliation
- Priority scoring rule engine (configurable weights)
- ERP / accounting webhook for automated Excel drop
- Multi-tenant setup

## Files of interest
- Backend: `/app/backend/server.py`
- Parser: `parse_outstanding()` in server.py
- Frontend: `/app/frontend/src/App.js` + `/app/frontend/src/pages/*.jsx` + `/app/frontend/src/App.css`
- Demo creds: `/app/memory/test_credentials.md`
