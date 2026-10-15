#!/usr/bin/env bash
cd "$(dirname "$0")"
PORT="${PORT:-8765}"
npx --yes serve -l "$PORT" &
SPID=$!
echo "Serving on http://localhost:$PORT (pid $SPID)"
if command -v cloudflared >/dev/null; then
  echo "Starting cloudflared (http2)…"
  cloudflared tunnel --protocol http2 --url "http://localhost:$PORT"
else
  wait $SPID
fi
