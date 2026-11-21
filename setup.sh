#!/usr/bin/env bash
# Worktree setup: install deps and symlink the local, gitignored files
# (config, databases, snapshots) from the main checkout.
set -euo pipefail
shopt -s nullglob

cd "$(dirname "$0")"

# The main checkout is the parent of the shared git dir.
main_checkout="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"

bun install

if [ "$main_checkout" != "$PWD" ]; then
  # Skip the -shm/-wal sidecars: SQLite recreates them next to the real db.
  for src in "$main_checkout"/dolphin.config.ts "$main_checkout"/*.db "$main_checkout"/data*.json "$main_checkout"/.private; do
    name="$(basename "$src")"
    if [ ! -e "$name" ] && [ ! -L "$name" ]; then
      ln -s "$src" "$name"
      echo "linked $name"
    fi
  done
fi
