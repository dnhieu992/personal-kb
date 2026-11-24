# syntax=docker/dockerfile:1

# ---- build stage: compile TypeScript → dist/ ----
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage: prod deps + compiled output only ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Piper (offline neural TTS) + one US English voice for GET /tts — the browser's
# Web Speech API can hang silently, so course audio is made here. ~90 MB.
ADD https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz /tmp/piper.tgz
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx /opt/piper/voice.onnx
ADD https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json /opt/piper/voice.onnx.json
RUN tar -xzf /tmp/piper.tgz -C /opt && rm /tmp/piper.tgz \
 && echo "Testing piper." | /opt/piper/piper --model /opt/piper/voice.onnx --output_file /tmp/t.wav && rm /tmp/t.wav
# The embedding model downloads to ./.cache on first use; mount a volume here
# (see docker-compose.prod.yml) so it survives container restarts.
EXPOSE 4001
CMD ["node", "dist/main.js"]
