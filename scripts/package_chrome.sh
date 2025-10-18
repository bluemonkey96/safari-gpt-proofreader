#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/chrome"
UNPACKED_DIR="$DIST_DIR/unpacked"

rm -rf "$DIST_DIR"
mkdir -p "$UNPACKED_DIR"

rsync -aL --exclude '.DS_Store' "$ROOT_DIR/chrome/" "$UNPACKED_DIR/"

(
  cd "$DIST_DIR"
  zip -qr "safari-gpt-proofreader-chrome.zip" "unpacked"
)

echo "Chrome package ready at $DIST_DIR/safari-gpt-proofreader-chrome.zip"
