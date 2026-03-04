#!/bin/bash
# Replace solana-release v1.18 (rustc 1.75) with Agave v3.1.9 (rustc 1.77+)
# Required for Anchor 0.32 — borsh, toml_edit etc. need rustc 1.76+
set -e
cd "$(dirname "$0")"

AGAVE_VERSION="v3.1.9"
URL="https://github.com/anza-xyz/agave/releases/download/${AGAVE_VERSION}/solana-release-x86_64-unknown-linux-gnu.tar.bz2"
TARBALL="/tmp/solana-release-${AGAVE_VERSION}.tar.bz2"

echo "=== Updating Solana tools: v1.18 → ${AGAVE_VERSION} ==="
echo "Current: $(solana --version 2>/dev/null || echo 'unknown')"

echo "Downloading ${AGAVE_VERSION}..."
curl -sSLf "$URL" -o "$TARBALL"

echo "Extracting to /tmp..."
tar -xjf "$TARBALL" -C /tmp
rm -f "$TARBALL"
NEW_DIR=""
[ -d "/tmp/solana-release-x86_64-unknown-linux-gnu" ] && NEW_DIR="/tmp/solana-release-x86_64-unknown-linux-gnu"
[ -d "/tmp/solana-release" ] && NEW_DIR="/tmp/solana-release"
[ -z "$NEW_DIR" ] && { echo "Error: unexpected archive structure"; ls -la /tmp/solana* 2>/dev/null; exit 1; }

echo "Replacing old solana-release..."
rm -rf solana-release
mv "$NEW_DIR" solana-release

echo "Done. New version:"
./solana-release/bin/solana --version
echo ""
echo "Run: export PATH=\"\$(pwd)/solana-release/bin:\$PATH\""
echo "Then: cd yumo-contracts && npm run build"
