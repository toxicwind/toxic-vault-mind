---
name: obsidian-plugin-publish
description: Publishing the Vault Mind Obsidian plugin from the pi-vault-mind monorepo to the separate obsidian-vault-mind repo via BRAT
---

# Publishing the Obsidian Plugin

## Architecture

- Source: `packages/obsidian/` in the `pi-vault-mind` monorepo
- Distribution repo: `kylebrodeur/obsidian-vault-mind` (releases only)
- Plugin ID: `vault-mind`
- BRAT install: `kylebrodeur/obsidian-vault-mind`

## Build

```bash
cd packages/obsidian && node esbuild.config.mjs production
```

## Publish (local)

```bash
./scripts/publish-obsidian-plugin.sh [version]
```

Reads version from `packages/obsidian/manifest.json` if not specified.
Clones plugin repo, copies `main.js`, `manifest.json`, `styles.css`, `versions.json`, `README.md`, commits, pushes, creates GitHub release.

## Publish (CI)

Tag with `obsidian-v<version>` and push. The `release-obsidian.yml` workflow runs the publish script.
Requires `PLUGIN_REPO_TOKEN` secret (PAT with repo scope).

## Test locally

```bash
# Copy to vault for immediate testing
cp packages/obsidian/main.js <vault>/.obsidian/plugins/vault-mind/main.js
obsidian plugin:reload id=vault-mind
obsidian dev:errors
```

## BRAT install command (for users)

```bash
obsidian eval code='(async()=>{await app.plugins.getPlugin("obsidian42-brat").betaPlugins.addPlugin("kylebrodeur/obsidian-vault-mind")})()'
```

Note: `betaPlugins.addPlugin` (not `addPlugin` on plugin root), async IIFE required.

## Version bump checklist

1. Bump `packages/obsidian/manifest.json` version
2. Bump root `manifest.json` to match
3. Build: `node esbuild.config.mjs production`
4. Commit
5. Run `./scripts/publish-obsidian-plugin.sh`
