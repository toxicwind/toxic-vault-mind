#!/usr/bin/env bash
# Create an isolated pi testing config with pi-vault-mind and its dependencies.
#
# Usage:
#   source scripts/setup-test-config.sh
#   # Then run pi from your test vault:
#   PI_CODING_AGENT_DIR="$TEST_CONFIG_DIR" pi
#
# This creates a clean ~/.pi-test/agent/ directory with:
#   - models.json (copied from your real config so providers work)
   - The required extensions installed: pi-context, pi-vault-mind
#
# The test config is isolated from your real ~/.pi/agent/ — no cross-contamination.

set -euo pipefail

TEST_CONFIG_DIR="${HOME}/.pi-test/agent"
REAL_CONFIG_DIR="${HOME}/.pi/agent"

echo "=== Setting up test pi config at ${TEST_CONFIG_DIR} ==="

# 1. Create directory structure
mkdir -p "${TEST_CONFIG_DIR}/npm/node_modules"
mkdir -p "${TEST_CONFIG_DIR}/extensions"
mkdir -p "${TEST_CONFIG_DIR}/sessions"

# 2. Copy models.json so providers work
if [ -f "${REAL_CONFIG_DIR}/models.json" ]; then
	cp "${REAL_CONFIG_DIR}/models.json" "${TEST_CONFIG_DIR}/models.json"
	echo "✓ Copied models.json"
else
	echo "⚠ No models.json found in ${REAL_CONFIG_DIR} — you'll need to configure providers manually"
fi

# 3. Install required extensions into the test config
#    We use PI_CODING_AGENT_DIR to target the test directory.
echo ""
echo "=== Installing extensions into test config ==="

export PI_CODING_AGENT_DIR="${TEST_CONFIG_DIR}"

# Install pi-context
echo "Installing pi-context..."
pi install npm:pi-context

# Install pi-vault-mind from local checkout
echo "Installing pi-vault-mind from local checkout..."
pi install "$(pwd)"

echo ""
echo "=== Test config ready ==="
echo ""
echo "To use it, run pi from your test vault with:"
echo "  PI_CODING_AGENT_DIR=\"${TEST_CONFIG_DIR}\" pi"
echo ""
echo "Or export it for the session:"
echo "  export PI_CODING_AGENT_DIR=\"${TEST_CONFIG_DIR}\""
echo "  cd /path/to/test-vault"
echo "  pi"
echo ""
echo "Verify with:"
echo "  PI_CODING_AGENT_DIR=\"${TEST_CONFIG_DIR}\" pi list"
