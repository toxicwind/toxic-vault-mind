#!/usr/bin/env bash
# scripts/publish-obsidian-plugin.sh
#
# Publishes the Obsidian plugin from packages/obsidian/ to the separate
# kylebrodeur/obsidian-vault-mind repo and creates a GitHub release.
#
# Usage:
#   ./scripts/publish-obsidian-plugin.sh [version]
#
# If version is omitted, reads from packages/obsidian/manifest.json.
# Requires: gh (GitHub CLI), git, jq

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_DIR="$REPO_ROOT/packages/obsidian"
TARGET_REPO="kylebrodeur/obsidian-vault-mind"

# Get version from manifest or argument
VERSION="${1:-$(jq -r .version "$PLUGIN_DIR/manifest.json")}"
echo "Publishing vault-mind plugin v$VERSION"

# Verify required files exist
for f in main.js manifest.json styles.css; do
  if [ ! -f "$PLUGIN_DIR/$f" ]; then
    echo "ERROR: $PLUGIN_DIR/$f not found. Run the plugin build first."
    exit 1
  fi
done

# Clone the target repo into a temp dir
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

if [ -n "${GH_TOKEN:-}" ]; then
  git clone "https://x-access-token:${GH_TOKEN}@github.com/$TARGET_REPO.git" "$TMPDIR/repo" --depth 1
else
  git clone "git@github.com:$TARGET_REPO.git" "$TMPDIR/repo" --depth 1
fi
cd "$TMPDIR/repo"

# Copy built assets
cp "$PLUGIN_DIR/main.js" .
cp "$PLUGIN_DIR/manifest.json" .
cp "$PLUGIN_DIR/styles.css" .
cp "$PLUGIN_DIR/versions.json" .
cp "$PLUGIN_DIR/README.md" .

# Commit and push if anything changed
if git diff --quiet && git diff --cached --quiet; then
  echo "No changes to plugin files."
else
  git add -A
  git commit -m "release: v$VERSION"
  git push origin main
  echo "Pushed updated plugin files to $TARGET_REPO"
fi

# Create release with assets (tag = version, no 'v' prefix per Obsidian convention)
if gh release view "$VERSION" --repo "$TARGET_REPO" >/dev/null 2>&1; then
  echo "Release $VERSION already exists, skipping."
else
  gh release create "$VERSION" \
    main.js \
    manifest.json \
    styles.css \
    --repo "$TARGET_REPO" \
    --title "v$VERSION" \
    --notes "Release v$VERSION of the Vault Mind Obsidian plugin.

Install via BRAT: add \`kylebrodeur/obsidian-vault-mind\` as a beta plugin.
Or download assets and extract to \`.obsidian/plugins/vault-mind/\`."
  echo "Created release $VERSION on $TARGET_REPO"
fi

echo "Done."
