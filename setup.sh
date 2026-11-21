#!/usr/bin/env bash
# Worktree setup: install deps, copy the databases and symlink the other local, gitignored files
# (config, snapshots, .private) from the main checkout.
set -euo pipefail
shopt -s nullglob

cd "$(dirname "$0")"

# The main checkout is the parent of the shared git dir.
main_checkout="$(cd "$(git rev-parse --git-common-dir)/.." && pwd)"

bun install

if [ "$main_checkout" != "$PWD" ]; then
  # Databases are copied, not linked: the server migrates on start, so a branch with a new migration would
  # otherwise apply it to the real board and stop the main checkout from starting. VACUUM INTO writes a consistent
  # copy even while the main server has the database open (WAL), which a plain cp does not.
  for src in "$main_checkout"/*.db; do
    name="$(basename "$src")"
    if [ ! -e "$name" ] && [ ! -L "$name" ]; then
      # Read-write without create: read-only cannot open a WAL database that has no -shm file yet.
      bun -e 'const { Database } = require("bun:sqlite"); const [src, dst] = process.argv.slice(1); new Database(src, { readwrite: true, create: false }).run("VACUUM INTO ?", [dst]);' "$src" "$PWD/$name"
      echo "copied $name"
    fi
  done

  for src in "$main_checkout"/dolphin.config.ts "$main_checkout"/data*.json "$main_checkout"/.private; do
    # dolphin.config.ts and .private are plain paths, not globs: skip them when the main checkout has none.
    [ -e "$src" ] || continue
    name="$(basename "$src")"
    if [ ! -e "$name" ] && [ ! -L "$name" ]; then
      ln -s "$src" "$name"
      echo "linked $name"
    fi
  done
fi
