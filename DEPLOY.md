# Deployment — CI build + GHCR + self-hosted runner

How code reaches production now:

```
merge → master
   └─ GitHub Actions (GitHub-hosted runner)
        • builds backend + frontend Docker images
        • pushes them to GHCR (ghcr.io/dnhieu992/personal-kb-*)
   └─ deploy job (self-hosted runner on the VPS)
        • docker compose pull   (only DOWNLOADS the prebuilt images)
        • docker compose up -d   (restart) — NOTHING is built on the VPS
```

Files: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.prod.yml`,
`.github/workflows/deploy.yml`.

---

## One-time setup on the VPS

### 1. Secrets file (never committed)
Create `/opt/personal-kb/backend.env` with the real values:

```bash
sudo mkdir -p /opt/personal-kb
sudo tee /opt/personal-kb/backend.env >/dev/null <<'EOF'
# host.docker.internal = the VPS host, where MySQL (3306) runs
DATABASE_URL=mysql://pkb:pkbpass@host.docker.internal:3306/personal_kb
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
FRONTEND_URL=http://<your-domain-or-ip>:4000
EOF
sudo chmod 600 /opt/personal-kb/backend.env
```

`QDRANT_URL` and `PORT` are set by `docker-compose.prod.yml`, so they don't go here.

### 2. Register the self-hosted runner
GitHub → repo **Settings → Actions → Runners → New self-hosted runner (Linux)**,
then run the shown commands on the VPS, e.g.:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner.tar.gz -L <url-from-github>
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/dnhieu992/personal-kb --token <token-from-github>
sudo ./svc.sh install      # run as a service so it survives reboots
sudo ./svc.sh start
```

The runner user must be able to run Docker (run as root, or `usermod -aG docker <user>`).
Default label `self-hosted` matches the workflow's `runs-on: [self-hosted]`.

### 3. Cut over from PM2 to Docker (once) — order matters
The old PM2 app `pkb-web` holds port 4000; free it **before** the first Docker
deploy, otherwise the frontend container can't bind the port:

```bash
export PM2_HOME=/root/.pm2
pm2 delete pkb-api pkb-web && pm2 save     # market-* apps stay untouched
docker rm -f pkb-qdrant 2>/dev/null         # old dev qdrant; volume is reused
```

Then trigger the **first deploy** through CI (the images don't exist in GHCR
until the build job has run at least once):

- push to `master`, **or** Actions tab → *Build & Deploy* → *Run workflow*.

The build job creates the GHCR images; the deploy job (on your runner) pulls them
and runs `docker compose up -d`. Your Qdrant vectors are preserved — the stack
reuses the existing `personal-kb_qdrant_data` volume. After this, every merge to
`master` redeploys automatically.

> Prefer a manual first run instead of CI? After at least one successful build
> job has pushed images, on the VPS: `docker login ghcr.io -u dnhieu992` (PAT with
> `read:packages`) then `TAG=latest docker compose -f docker-compose.prod.yml up -d`.

---

## Day-to-day
- **Deploy**: merge to `master`. Done.
- **Manual redeploy**: Actions tab → *Build & Deploy* → *Run workflow*.
- **Rollback**: pick a previous commit SHA and pin it:
  ```bash
  TAG=<old-sha> docker compose -f docker-compose.prod.yml up -d
  ```
  (Every build is tagged with its commit SHA in GHCR.)
- **Logs**: `docker compose -f docker-compose.prod.yml logs -f backend`

## Notes / caveats
- **GHCR free tier**: first image pull is large (~860 MB backend), but redeploys
  pull only the small changed layer thanks to layer caching. If transfer ever
  becomes an issue, make the GHCR package **public** (free unlimited bandwidth).
- **Node parity**: images use `node:22-slim`; the VPS no longer needs Node at all
  for these apps (everything runs in containers).
- **`synchronize: true`** is still on (auto-syncs the MySQL schema). Fine for now;
  switch to TypeORM migrations before treating this as real production data.
- Only port **4000** is published. The backend (4001) is internal to the compose
  network and reached through the Next.js `/api-proxy` rewrite.
