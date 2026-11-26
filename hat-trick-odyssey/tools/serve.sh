#!/usr/bin/env bash
# Usage: tools/serve.sh PORT   (serves the project folder as static files)
cd "$(dirname "$0")/.." || exit 1
exec python3 -m http.server "${1:-8100}" --bind 127.0.0.1
