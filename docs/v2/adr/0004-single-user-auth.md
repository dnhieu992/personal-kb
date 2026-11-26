# 0004 — Single-user auth: password hash in env + signed stateless cookie

`AUTH_PASSWORD_HASH` (scrypt via Node `crypto`, format `scrypt$N$r$p$salt$hash`) — chosen over argon2 to avoid
a native module in Alpine images; scrypt is also memory-hard. Login sets `pkb_session = <exp>.<hmac>` (httpOnly,
SameSite=Lax, `Secure` when `COOKIE_SECURE=true`). A global `AuthGuard` (APP_GUARD) closes every route; `@Public()`
opens `/health`, `/auth/login`, and the signature-checked local storage URLs. Login is rate limited (5/min).
API binds `127.0.0.1`; the browser only talks to the web origin, which proxies `/api/*`. No CORS. Rotating
`SESSION_SECRET` logs out all sessions.
