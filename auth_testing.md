# Sripati Collection Desk Authentication Testing

## Demo accounts
- owner@sripati.local / Sripati@123 — owner
- head@sripati.local / Sripati@123 — head_officer
- field1@sripati.local / Sripati@123 — field_officer
- field2@sripati.local / Sripati@123 — field_officer
- field3@sripati.local / Sripati@123 — field_officer

## API checks
1. POST `/api/auth/login` with a demo account; verify user role and an httpOnly access cookie.
2. GET `/api/auth/me` with the same cookie; verify the session user.
3. GET `/api/dashboard`, `/api/dispatches`, `/api/parties`, and `/api/reports` while authenticated.
4. POST `/api/auth/logout`; verify the cookie is cleared and `/api/auth/me` returns 401.
5. POST `/api/import/preview` with the uploaded PDF; verify review statuses and source metadata.

All seeded users are demo users and have `force_password_change` enabled.