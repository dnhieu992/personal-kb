# 0005 — `due_date` / `pinned_for` are DATE, "today" comes from one Clock

They are days on my calendar, not instants. Stored as `DATE`, read as `YYYY-MM-DD` strings (mysql2
`dateStrings: ['DATE']`), compared as strings. `Clock.today()` (APP_TZ, default Asia/Ho_Chi_Minh) is the only
source of "today". Auto-unpin needs no cron: Today only matches `pinned_for = today`.
