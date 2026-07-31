#!/usr/bin/env bash
# vault-pi.sh — Start pi for a vault, ensuring only one instance runs.
#
# Usage:
#   bash scripts/vault-pi.sh /path/to/vault
#
# Obsidian Shell Commands integration:
#   Command: bash /path/to/pi-vault-mind/scripts/vault-pi.sh {{vault_path}}
#
# The script:
#   1. Checks for an existing PID file at <vault>/.vault-mind/.pi/agent/daemon.pid
#   2. If the PID is alive → exits silently (already running)
#   3. If stale/dead → cleans up and starts fresh
#   4. Opens a new terminal window with pi using the vault-local config dir

set -euo pipefail

VAULT="${1:?Usage: vault-pi.sh <vault-path>}"
PI_DIR="${VAULT}/.vault-mind/.pi/agent"
PID_FILE="${PI_DIR}/daemon.pid"

# Ensure the vault-local agent dir exists
mkdir -p "${PI_DIR}"

# Check for existing process
if [ -f "${PID_FILE}" ]; then
	PID=$(cat "${PID_FILE}")
	if kill -0 "${PID}" 2>/dev/null; then
		echo "[vault-pi] pi already running for ${VAULT} (PID ${PID})"
		exit 0
	fi
	echo "[vault-pi] Stale PID file (${PID} is dead), cleaning up"
	rm -f "${PID_FILE}"
fi

# --op-env is a flag registered by pi-1password. Passing it when that
# extension isn't installed makes pi reject the whole invocation with
# "Unknown option: --op-env" — only pass it when both the env file exists
# AND pi-1password is actually installed in the vault-local agent dir.
OP_ENV_ARG=""
if [ -f "${VAULT}/.vault-mind/.env.1pass" ] && [ -d "${PI_DIR}/npm/node_modules/pi-1password" ]; then
	OP_ENV_ARG="--op-env .vault-mind/.env.1pass"
fi

# Start pi in a new terminal window.
# macOS: open -a Terminal or open -a iTerm
# The trap writes the PID and cleans up on exit.
PI_CMD="PI_CODING_AGENT_DIR='${PI_DIR}' pi ${OP_ENV_ARG}; rm -f '${PID_FILE}'"

if [ -d "/Applications/iTerm.app" ]; then
	open -a iTerm --args --detach bash -c "echo \$\$ > '${PID_FILE}'; cd '${VAULT}'; ${PI_CMD}"
elif [ -d "/Applications/Utilities/Terminal.app" ]; then
	osascript -e "tell application \"Terminal\" to do script \"echo \$\$ > '${PID_FILE}'; cd '${VAULT}'; ${PI_CMD}\""
else
	echo "[vault-pi] No supported terminal found (iTerm or Terminal.app)"
	exit 1
fi

echo "[vault-pi] Started pi for ${VAULT}"
