---
name: pi-vault-mind-release
description: "Release workflow for the pi-vault-mind monorepo: version bump, build, commit, GitHub releases, Obsidian plugin publish, BRAT test-vault install, npm publish"
---

# pi-vault-mind release workflow

Use this when cutting a new release of `pi-vault-mind` (backend/core) and `obsidian-pi-vault-mind` (Obsidian plugin).

## Preconditions

- `pnpm check` passes.
- `pnpm test` passes.
- `packages/obsidian` build passes (`pnpm --filter obsidian-pi-vault-mind build`).

## Version files to bump

Keep versions aligned for coordinated releases:

- `package.json` root → `pi-vault-mind` package version.
- `packages/obsidian/package.json` → plugin package version (should track manifest).
- `packages/obsidian/manifest.json` → `version`.
- `manifest.json` root → mirror `packages/obsidian/manifest.json`.
- `packages/obsidian/versions.json` → add new row: `"<version>": "<minAppVersion>"`.

Example: bump root to `0.13.0`, plugin files to `0.5.0`.

For **plugin-only hotfixes**, bump only the plugin files (`packages/obsidian/package.json`, `packages/obsidian/manifest.json`, root `manifest.json`, `versions.json`). Do **not** bump the root `package.json` if the npm package itself did not change.

## Build and verify

```bash
pnpm run build
pnpm --filter obsidian-pi-vault-mind build
pnpm check && pnpm test
```

## Update CHANGELOG.md

Add a section under `# Changelog` at the top, e.g.:

```markdown
## 0.5.1 — YYYY-MM-DD

### Fixed
...

## 0.13.0 / 0.5.0 — YYYY-MM-DD

### Added
...
```

For plugin-only hotfixes, use a plugin-version-only header.

## Commit and push

```bash
git add -A
git commit -m "feat: <summary>"
git push origin main
```

For a plugin-only hotfix:

```bash
git commit -m "fix(obsidian): <summary>

- Root package stays at 0.13.0 since the npm package did not change."
```

## Create GitHub releases

Main repo (only when the npm package / root changed):

```bash
gh release create v<version> --repo kylebrodeur/pi-vault-mind \
  --title "v<version> — <summary>" \
  --notes "<markdown release notes>"
```

Obsidian plugin repo:

```bash
bash scripts/publish-obsidian-plugin.sh <plugin-version>
```

This script pushes `manifest.json`, `main.js`, `styles.css`, and `versions.json` to `kylebrodeur/obsidian-vault-mind` and creates a GitHub release there.

## Install/update in the test vault via BRAT

Never manually copy plugin files into `.obsidian/plugins/vault-mind/`. Let BRAT manage the install.

The ReturnVape test vault has BRAT configured with `kylebrodeur/obsidian-vault-mind` as a beta plugin. Trigger an update:

```bash
obsidian command id=obsidian42-brat:checkForUpdatesAndUpdate vault=ReturnVape
```

Then verify:

```bash
obsidian plugin id=vault-mind vault=ReturnVape
obsidian plugin:reload id=vault-mind vault=ReturnVape
obsidian dev:errors --vault ReturnVape
obsidian dev:console --vault ReturnVape --lines 50
```

Expected: plugin version matches the new release, reload succeeds, no plugin-load errors.

## Reset the test vault data (optional)

```bash
./scripts/reset-test-vault.sh
```

This removes `.pi/`, `.lancedb/`, `pi-vault-mind.config.json`, and `collections/` while preserving vault notes and `.obsidian/` (including the BRAT-managed plugin).

## Publish to npm (only when root package changed)

```bash
npm pack
npm publish pi-vault-mind-<version>.tgz --otp=<your-otp>
```

Requires the user's one-time password.

## Post-release smoke test

1. Open the vault in Obsidian.
2. Trigger BRAT update if not already done.
3. Open the Vault Mind panel → Setup tab.
4. Walk through init: model-router picker, Modal setup + test connection, chat composer, session popover.
5. Exercise the **Vault Mind: Dispatch agent** palette command on a note with `@agent` markers.
6. Verify chat messages render and actions (copy/info/rewind) work.

## Obsidian dependency bundling rule

If the plugin imports an npm package (e.g. `json5`), it must be bundled into `main.js`. Do **not** list it in `esbuild.config.mjs`'s `external` array. Only `obsidian`, `electron`, `@codemirror/view`, and Node built-ins should be external.

Verify a dependency is bundled by ensuring `main.js` contains its code and that `require("<dep>")` does not appear in the bundle.
