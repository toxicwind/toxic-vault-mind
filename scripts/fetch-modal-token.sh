#!/usr/bin/env bash
# Fetch the Modal embedding API token from 1Password and export or persist it.
# Usage:
#   ./scripts/fetch-modal-token.sh --export              # prints an export line
#   ./scripts/fetch-modal-token.sh --write [vault-path]  # writes to <vault>/.vault-mind/vault-mind.env
#
# The 1Password item must be titled "pi-vault-mind-auth" with the token in the
# password field.

set -euo pipefail

OP_ITEM="pi-vault-mind-auth"
OP_FIELD="password"
VAULT="${2:-$(pwd)}"
ENV_DIR="${VAULT}/.vault-mind"
ENV_FILE="${ENV_DIR}/vault-mind.env"

mode="write"
if [ "${1:-}" = "--export" ]; then
	mode="export"
elif [ "${1:-}" = "--write" ]; then
	mode="write"
elif [ -n "${1:-}" ]; then
	echo "Unknown option: $1" >&2
	echo "Usage: $0 [--export | --write]" >&2
	exit 1
fi

if ! command -v op >/dev/null 2>&1; then
	echo "❌ 1Password CLI (op) not found. Install: brew install 1password-cli" >&2
	exit 1
fi

# Check if already exported to avoid clobbering a live session.
if [ -n "${PVM_REMOTE_EMBEDDING_API_KEY:-}" ]; then
	echo "⚠️ PVM_REMOTE_EMBEDDING_API_KEY is already exported; skipping 1Password fetch." >&2
	if [ "$mode" = "export" ]; then
		echo "export PVM_REMOTE_EMBEDDING_API_KEY=\"${PVM_REMOTE_EMBEDDING_API_KEY}\""
	else
		echo "Token already available in environment."
	fi
	exit 0
fi

# Try to read without explicit account; op will use the default signed-in account.
TOKEN=$(op item get "$OP_ITEM" --reveal --field "$OP_FIELD" 2>/dev/null) || {
	echo "❌ Could not read 1Password item '$OP_ITEM' field '$OP_FIELD'." >&2
	echo "   Make sure you are signed in (op signin) and the item exists." >&2
	exit 1
}

if [ -z "$TOKEN" ]; then
	echo "❌ Token is empty." >&2
	exit 1
fi

if [ "$mode" = "export" ]; then
	echo "export PVM_REMOTE_EMBEDDING_API_KEY=\"${TOKEN}\""
else
	mkdir -p "$ENV_DIR"
	printf 'PVM_REMOTE_EMBEDDING_API_KEY="%s"\n' "$TOKEN" > "$ENV_FILE"
	# chmod is a no-op on Windows (Git Bash / MINGW); skip it to avoid errors.
	if [[ "$(uname -s)" != MINGW* ]]; then
		chmod 600 "$ENV_FILE"
	fi
	echo "✅ Wrote PVM_REMOTE_EMBEDDING_API_KEY to ${ENV_FILE}"
fi
