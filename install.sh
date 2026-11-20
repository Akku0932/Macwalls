#!/bin/bash
set -euo pipefail

# Ensure running on macOS
if [ "$(uname)" != "Darwin" ]; then
    echo "Error: Macwalls is only supported on macOS." >&2
    exit 1
fi

echo "=========================================="
echo "      Installing Macwalls for macOS       "
echo "=========================================="

TMP_DIR="$(mktemp -d)"
MOUNT_DIR="$(mktemp -d)"

cleanup() {
    if mount | grep -q "$MOUNT_DIR"; then
        hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
    fi
    rm -rf "$TMP_DIR" "$MOUNT_DIR" 2>/dev/null || true
}
trap cleanup EXIT

DMG_URL="https://macwalls-app.vercel.app/api/download"
DMG_PATH="$TMP_DIR/Macwalls.dmg"

echo "==> Downloading Macwalls..."
curl -fSL "$DMG_URL" -o "$DMG_PATH" --progress-bar

echo "==> Mounting installer..."
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

echo "==> Installing to /Applications..."
rm -rf "/Applications/Macwalls.app"
cp -R "$MOUNT_DIR/Macwalls.app" "/Applications/"

hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true

echo "==> Applying macOS permissions..."
xattr -cr "/Applications/Macwalls.app" 2>/dev/null || true

echo ""
echo "=========================================="
echo " ✓ Macwalls successfully installed!"
echo "=========================================="
echo "==> Launching Macwalls..."
open "/Applications/Macwalls.app"
