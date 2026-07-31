#!/usr/bin/env bash
# pi-vault-mind dependency audit — checks pi extensions and Obsidian plugins.
#
# Usage:
#   bash scripts/check-deps.sh              # check pi extensions only
#   bash scripts/check-deps.sh --obsidian    # also check Obsidian plugins
#   bash scripts/check-deps.sh --fix        # print install commands for missing deps
#
# Exit code: 0 = all required deps present, 1 = missing required deps,
#            2 = optional deps missing (with --strict).

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CHECK_OBSIDIAN=false
FIX_MODE=false
STRICT=false

for arg in "$@"; do
	case "$arg" in
		--obsidian) CHECK_OBSIDIAN=true ;;
		--fix) FIX_MODE=true ;;
		--strict) STRICT=true ;;
		*) echo "Unknown flag: $arg"; exit 2 ;;
	esac
done

MISSING_REQUIRED=0
MISSING_OPTIONAL=0

check() { printf "  %-50s " "$1 …"; }
pass() { printf "${GREEN}✓${NC} %s\n" "$1"; }
fail() { printf "${RED}✗${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}⚠${NC} %s\n" "$1"; }

echo ""
echo "=== pi-vault-mind Dependency Audit ==="
echo ""

# ── pi extensions (canonical list from extension-packages.json) ──────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKGS_JSON="${SCRIPT_DIR}/../extension-packages.json"

if ! command -v jq >/dev/null 2>&1; then
	echo "WARNING: jq not found — skipping pi extension checks"
else

echo "── pi extensions ──"

# pi itself
check "pi CLI"
if command -v pi &>/dev/null; then
	pass "$(pi --version 2>/dev/null || echo 'installed')"
else
	fail "not found — install from https://github.com/mariozechner/pi"
	MISSING_REQUIRED=$((MISSING_REQUIRED + 1))
fi

# Required extensions (from canonical JSON)
for pkg in $(jq -r '.required[]' "${PKGS_JSON}"); do
	label="${pkg#npm:}"
	check "${label}"
	if pi list 2>/dev/null | grep -q "${label}"; then
		pass "installed"
	else
		fail "not installed"
		if $FIX_MODE; then
			echo "         → pi install ${pkg}"
		fi
		MISSING_REQUIRED=$((MISSING_REQUIRED + 1))
	fi
done


# Optional pi extensions (from canonical JSON)
for pkg in $(jq -r '.optional[]' "${PKGS_JSON}"); do
	label="${pkg#npm:}"
	check "${label} (optional)"
	if pi list 2>/dev/null | grep -q "${label}"; then
		pass "installed"
	else
		warn "not installed"
		if $FIX_MODE; then
			echo "         → pi install ${pkg}"
		fi
		MISSING_OPTIONAL=$((MISSING_OPTIONAL + 1))
	fi
done
fi  # jq available

# ── Optional pi extensions ────────────────────────────────────────────────

echo ""
echo "── optional pi extensions ──"

check "notebooklm-mcp-cli (nlm)"
if command -v nlm &>/dev/null; then
	pass "$(nlm --version 2>/dev/null || echo 'installed')"
else
	warn "not installed — Broadcaster podcast generation unavailable"
	if $FIX_MODE; then
		echo "         → npm install -g notebooklm-cli"
	fi
	MISSING_OPTIONAL=$((MISSING_OPTIONAL + 1))
fi

check "any2md (document ingestion)"
if command -v any2md &>/dev/null; then
	pass "installed"
else
	warn "not installed — Miner PDF/URL ingestion unavailable"
	if $FIX_MODE; then
		echo "         → npm install -g any2md"
	fi
	MISSING_OPTIONAL=$((MISSING_OPTIONAL + 1))
fi

# ── Obsidian plugins ──────────────────────────────────────────────────────

if $CHECK_OBSIDIAN; then
	echo ""
	echo "── Obsidian plugins ──"

	check "obsidian CLI"
	if command -v obsidian &>/dev/null; then
		pass "$(obsidian version 2>/dev/null || echo 'installed')"
	else
		warn "not found — plugin checks skipped (enable in Settings → CLI)"
		echo ""
		echo "=== Summary ==="
		summary
		exit $EXIT_CODE
	fi

	# Recommended community plugins
	RECOMMENDED_PLUGINS=(
		"obsidian-git:version control for vault"
		"obsidian-breadcrumbs:note relationship navigation"
		"graph-analysis:graph visualization"
		"actions-uri:external tool triggers"
		"shellcommands:shell command integration"
	)

	for entry in "${RECOMMENDED_PLUGINS[@]}"; do
		id="${entry%%:*}"
		desc="${entry#*:}"
		check "$id"
		if obsidian plugins:enabled 2>/dev/null | grep -q "$id"; then
			pass "$desc"
		else
			warn "not enabled — $desc"
			if $FIX_MODE; then
				echo "         → obsidian plugin:install id=$id enable"
			fi
			MISSING_OPTIONAL=$((MISSING_OPTIONAL + 1))
		fi
	done

	# kepano/obsidian-skills
	echo ""
	echo "── pi skills (kepano/obsidian-skills) ──"
	SKILLS=(
		"obsidian-markdown"
		"obsidian-bases"
		"json-canvas"
		"obsidian-cli"
		"defuddle"
	)
	for skill in "${SKILLS[@]}"; do
		check "$skill"
		if [ -f "$HOME/.pi/agent/skills/$skill/SKILL.md" ]; then
			pass "installed"
		else
			warn "not installed"
			if $FIX_MODE; then
				echo "         → npx -y skills add https://github.com/kepano/obsidian-skills --skill $skill -g -a pi --copy -y"
			fi
			MISSING_OPTIONAL=$((MISSING_OPTIONAL + 1))
		fi
	done
fi

# ── Summary ────────────────────────────────────────────────────────────────

summary() {
	echo ""
	echo "── Result ──"
	if [ "$MISSING_REQUIRED" -eq 0 ] && [ "$MISSING_OPTIONAL" -eq 0 ]; then
		echo "${GREEN}All dependencies present.${NC}"
	elif [ "$MISSING_REQUIRED" -eq 0 ]; then
		echo "${YELLOW}$MISSING_OPTIONAL optional dependency(s) missing. Core system will work.${NC}"
	else
		echo "${RED}$MISSING_REQUIRED required dependency(s) missing. System will not function correctly.${NC}"
	fi
}

summary

if $STRICT && [ "$MISSING_OPTIONAL" -gt 0 ]; then
	exit 2
elif [ "$MISSING_REQUIRED" -gt 0 ]; then
	exit 1
else
	exit 0
fi
