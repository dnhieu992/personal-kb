# Build context: repo root (monorepo). docker build -f apps/api/Dockerfile .
# Debian slim (glibc), not alpine: the Claude Code native binary, Piper TTS and
# onnxruntime (MiniLM embeddings) all ship glibc builds.
FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @pkb/api...
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @pkb/contracts build && pnpm --filter @pkb/api build \
 && pnpm --filter @pkb/api deploy --prod --legacy /out

FROM node:20-slim
ENV NODE_ENV=production \
    PIPER_BIN=/opt/piper/piper \
    PIPER_MODEL=/opt/piper/voice.onnx \
    TTS_CACHE_DIR=/app/.cache \
    MODEL_CACHE_DIR=/app/.cache/models
# mysqldump for the nightly backup (MariaDB client: talks to MySQL 8 fine for dumps)
RUN apt-get update && apt-get install -y --no-install-recommends mariadb-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Piper (offline neural TTS) + one US English voice for GET /api/english/tts
ADD https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz /tmp/piper.tgz
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx /opt/piper/voice.onnx
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json /opt/piper/voice.onnx.json
RUN tar -xzf /tmp/piper.tgz -C /opt && rm /tmp/piper.tgz \
 && echo "Testing piper." | /opt/piper/piper --model /opt/piper/voice.onnx --output_file /tmp/t.wav && rm /tmp/t.wav
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
# Migrations run as a separate deploy step: `node dist/migrate.js`
CMD ["node", "dist/main.js"]
