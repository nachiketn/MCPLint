#!/usr/bin/env sh
# Build the sandbox image and capture snapshots into pilot/snapshots/.
# Optional: pass server ids to capture only those, e.g. ./run.sh github azure
set -e
cd "$(dirname "$0")"
mkdir -p ../snapshots
docker build -t mcpsmell-snapshot .
docker run --rm \
  --cap-drop ALL --security-opt no-new-privileges \
  --memory 4g --cpus 2 \
  -v "$(cd ../snapshots && pwd):/out" \
  mcpsmell-snapshot "$@"
