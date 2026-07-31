#!/usr/bin/env bash
# setup-vault-pi.sh — Bootstrap a vault-local pi agent config.
#
# Run from the vault root. Creates .vault-mind/.pi/agent/ with pi-vault-mind,
# pi-context, pi-model-discovery, and pi-model-router installed locally,
# isolated from your global ~/.pi/agent/. If the 1Password CLI (op) is
# detected, also installs pi-1password so .vault-mind/.env.1pass (op://
# references) resolves at pi startup.
#
# Usage:
#   cd /path/to/vault
#   bash scripts/setup-vault-pi.sh
#
# After setup, start pi with:
#   PI_CODING_AGENT_DIR="$(pwd)/.vault-mind/.pi/agent" pi

set -euo pipefail

VAULT_ROOT="${1:-$(pwd)}"
PI_DIR="${VAULT_ROOT}/.vault-mind/.pi/agent"

echo "==> Setting up vault-local pi config at ${PI_DIR}"

mkdir -p "${PI_DIR}"

# Locate the canonical package list (generated from src/extension-packages.ts).
# The JSON ships next to the scripts/ directory in the npm package.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKGS_JSON="${SCRIPT_DIR}/../extension-packages.json"

if ! command -v jq >/dev/null 2>&1; then
	echo "ERROR: jq is required to parse extension-packages.json. Install it: brew install jq"
	exit 1
fi

# Install required pi extensions from the canonical list.
echo "==> Installing required pi extensions..."
for pkg in $(jq -r '.required[]' "${PKGS_JSON}"); do
	echo "    ${pkg}"
	PI_CODING_AGENT_DIR="${PI_DIR}" pi install "${pkg}"
done

# --op-env is a flag registered by pi-1password; only install optional
# extensions when their prerequisites are met.
OP_ENV_HINT=""
for pkg in $(jq -r '.optional[]' "${PKGS_JSON}"); do
	case "${pkg}" in
		npm:pi-1password)
			if command -v op >/dev/null 2>&1; then
				echo "==> 1Password CLI detected — installing ${pkg}"
				PI_CODING_AGENT_DIR="${PI_DIR}" pi install "${pkg}"
				OP_ENV_HINT=" --op-env .vault-mind/.env.1pass"
			fi
			;;
		*)
			echo "==> Installing optional extension: ${pkg}"
			PI_CODING_AGENT_DIR="${PI_DIR}" pi install "${pkg}"
			;;
	esac
done

echo ""
echo "==> Done. Start pi for this vault with:"
echo "    PI_CODING_AGENT_DIR=\"${PI_DIR}\" pi${OP_ENV_HINT}"
echo ""
echo "    Or from Obsidian Shell Commands:"
echo "    PI_CODING_AGENT_DIR=${PI_DIR} pi${OP_ENV_HINT}"
echo ""
echo "    Then inside the pi session, run /vm setup — it scaffolds"
echo "    .vault-mind/vault-mind.config.json AND .vault-mind/.pi/model-router.json"
echo "    (tuned primary/fallback model defaults) in one step."
