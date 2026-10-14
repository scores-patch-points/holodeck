#!/usr/bin/env bash
# deploy.sh — copy the contracts API to the VM and (re)start it. Never writes to root disk beyond the unit file.
set -euo pipefail
HOST=${HOST:-hyphae}; DEST=${DEST:-/mnt/watch/contracts-api}
here=$(cd "$(dirname "$0")" && pwd)
ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" "mkdir -p $DEST"
scp -o BatchMode=yes -q "$here/build_index.py" "$here/server.py" "$HOST:$DEST/"
ssh -o BatchMode=yes "$HOST" "cd $DEST && python3 build_index.py"
