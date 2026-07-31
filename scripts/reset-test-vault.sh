#!/usr/bin/env bash
# scripts/reset-test-vault.sh
#
# Completely reset a vault for walkthrough testing.
# Removes all pi-vault-mind state and runtime artifacts while preserving vault content and Obsidian plugins.
#
# Usage:
#   ./scripts/reset-test-vault.sh [vault-path]
#
# Default vault: ~/workspace/recycvape/ReturnVape/

set -euo pipefail

VAULT="${1:-$HOME/workspace/recycvape/ReturnVape}"

if [ ! -d "$VAULT" ]; then
  echo "ERROR: Vault not found at $VAULT"
  exit 1
fi

VAULT_REALPATH="$(cd "$VAULT" && pwd -P)"

# Stop only the runtime that proves it serves this vault before deleting its
# discovery record. A stale/reused PID must never be signalled.
SERVER_STATE="$VAULT/.vault-mind/server.json"
if [ -f "$SERVER_STATE" ]; then
  SERVER_METADATA="$(node -e 'const fs = require("node:fs"); try { const { pid, port } = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (Number.isSafeInteger(pid) && pid > 0 && Number.isSafeInteger(port) && port > 0 && port < 65536) process.stdout.write(`${pid} ${port}`); } catch {}' "$SERVER_STATE")"
  read -r SERVER_PID SERVER_PORT <<< "$SERVER_METADATA"
  if [ -n "${SERVER_PID:-}" ] && [ -n "${SERVER_PORT:-}" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    if ! command -v lsof >/dev/null 2>&1; then
      echo "ERROR: lsof is required to verify the registered Vault Mind runtime" >&2
      exit 1
    fi
    SERVER_CWD="$(lsof -a -p "$SERVER_PID" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2- || true)"
    SERVER_PORT_OWNERS="$(lsof -nP -t -iTCP:"$SERVER_PORT" -sTCP:LISTEN 2>/dev/null || true)"
    if [ "$SERVER_CWD" = "$VAULT_REALPATH" ] && printf '%s\n' "$SERVER_PORT_OWNERS" | grep -qx "$SERVER_PID"; then
      echo "Stopping Vault Mind runtime (PID $SERVER_PID)"
      kill -TERM "$SERVER_PID" 2>/dev/null || true
      for _ in {1..20}; do
        if ! kill -0 "$SERVER_PID" 2>/dev/null; then
          break
        fi
        sleep 0.1
      done
      if kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "Force-stopping Vault Mind runtime (PID $SERVER_PID)"
        kill -KILL "$SERVER_PID" 2>/dev/null || true
        for _ in {1..20}; do
          if ! kill -0 "$SERVER_PID" 2>/dev/null; then
            break
          fi
          sleep 0.1
        done
        if kill -0 "$SERVER_PID" 2>/dev/null; then
          echo "ERROR: Vault Mind runtime did not stop (PID $SERVER_PID)" >&2
          exit 1
        fi
      fi
    else
      echo "Ignoring unverified Vault Mind runtime registry"
    fi
  fi
fi

echo "Resetting vault: $VAULT"

# Remove pi-vault-mind state
rm -rf "$VAULT/.pi"
rm -f  "$VAULT/pi-vault-mind.config.json"
rm -rf "$VAULT/.lancedb"
rm -rf "$VAULT/collections"
rm -f  "$VAULT/_sync_state.json"
rm -rf "$VAULT/.vault-mind"
rm -rf "$VAULT/.omp"
rm -rf "$VAULT/Pi-Sessions"
rm -f  "$VAULT/AGENTS.md"
rm -f  "$VAULT/.env.1pass"
# Remove Agent subdirectories scaffolded by setup, preserving user content
for dir in Inbox Library Presentations Journal; do
  rm -rf "$VAULT/Agent/$dir"
done
# Remove Agent root only if empty after subdirectory cleanup
rmdir "$VAULT/Agent" 2>/dev/null || true
rm -rf "$VAULT/.obsidian/plugins/vault-mind"


echo ""
echo "✓ Vault reset complete. State removed:"
echo "  - .omp/ (harness runtime state)"
echo "  - .vault-mind/ (config, token, framework agent dir, queue)"
echo "  - .obsidian/plugins/vault-mind/ (plugin, reinstall via BRAT)"
echo "  - .pi/ (legacy agent dir, if present)"
echo "  - .lancedb/ (vector index)"
echo "  - collections/ (JSONL data)"
echo "  - Pi-Sessions/ (session files)"
echo "  - AGENTS.md (personalized agent delegation)"
echo "  - .env.1pass (runtime config)"
echo "  - Agent/ subdirectories (Inbox, Library, Presentations, Journal)"
echo ""
echo "Preserved:"
echo "  - Vault content (notes, folders)"
echo "Next: Pull the released plugin through BRAT, then open Vault Mind → Setup tab"
