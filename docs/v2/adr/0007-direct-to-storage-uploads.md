# 0007 — Direct-to-storage uploads through a StoragePort

Bytes never pass through the API: `POST /notes/:id/attachments` → pending row + presigned PUT → browser uploads
→ `POST /attachments/:id/confirm` (API HEADs the object). Reads go through `/api/attachments/:id/raw`, which needs
the session and 302s to a 10-minute presigned GET — so markdown can embed a stable URL for a private bucket.
Adapters: `R2Adapter` (prod, private bucket; needs a CORS rule allowing PUT from the web origin) and
`LocalAdapter` (dev; same flow with HMAC-signed URLs served by the API). Abandoned pending uploads are swept
hourly after 24h; object deletion goes through the job queue (0008).
