---
name: pre-test-release
description: "Use before handing off to the user for manual testing — runs full CI, updates docs/versions, publishes plugin, resets test vault, and alerts for npm OTP."
---

# Pre-Test Release Checklist

Run this procedure when implementation is complete and the user needs a clean, publishable build to test against.

## 1. Full CI Check

```bash
cd packages/obsidian && npx tsc --noEmit          # plugin types
cd ~/workspace/pi-vault-mind && pnpm run build     # full project build
cd ~/workspace/pi-vault-mind && pnpm test          # all tests (expect 238 pass / 0 fail)
cd packages/obsidian && node esbuild.config.mjs production  # plugin bundle
```

All must pass with zero errors. Fix any issues before proceeding. Do not rely on piped `tail` for exit status — verify the actual test summary and exit code.

## 2. Clean Git Tree

```bash
git status   # must be clean — no unstaged, no untracked
```

If dirty: stage and commit with an appropriate message, or stash unrelated changes.

## 3. Docs Review & Update

- Read `docs/NEXT_STEPS.md` — move completed items to ✅ Shipped, update Now/Next
- Read `docs/ROADMAP.md` — add new version row to Shipped table, update date and current status
- Read `docs/getting-started/WALKTHROUGH.md` — verify steps match current behavior
- Commit doc changes: `docs: update status for v<version>`

## 4. Version Bump

Determine bump type (patch/minor) based on changes. Update ALL version files:

```python
# package.json — npm package version
# packages/obsidian/manifest.json — plugin version
# manifest.json (root) — mirror of plugin manifest
# packages/obsidian/versions.json — add "<plugin-ver>": "<minAppVersion>"
```

Rebuild plugin after bump: `cd packages/obsidian && node esbuild.config.mjs production`

## 5. Commit, Push, Release

Write the release notes to a temp markdown file so multi-line formatting is preserved literally. Use the `write` tool to save it to `/tmp/release-notes-v<npm-ver>.md`:

```markdown
## What's new

< bullets >

## Release gate

< pending verification, known issues >
```

```bash
git add -A
git commit -m "feat(...): <summary>\n\n<details>"
git push origin main
gh release create v<npm-ver> --title "v<npm-ver>" --notes-file /tmp/release-notes-v<npm-ver>.md
```

## 6. Publish Obsidian Plugin

```bash
bash scripts/publish-obsidian-plugin.sh <plugin-ver>
```

This clones `kylebrodeur/obsidian-vault-mind`, copies built assets, commits, pushes, and creates a GH release with main.js + manifest.json + styles.css.

## 7. Reset & Update Test Vault

```bash
./scripts/reset-test-vault.sh
```

This removes `.pi/`, config, `.lancedb/`, `collections/`, and copies the latest plugin build into the test vault.

After reset, remind user to **reload the plugin in Obsidian** (reopen vault or disable/re-enable plugin).

## 8. npm Pack & Test

```bash
cd ~/workspace/pi-vault-mind
npm pack --dry-run    # verify package contents look correct
npm pack              # create tarball for inspection
```

## 9. Alert User

Tell the user:
- Everything is published (GH releases for both repos)
- Test vault is reset and ready
- npm needs their OTP: `npm publish --otp=<code>`
- Where to start testing (specific WALKTHROUGH step or doc section)
- What was changed since last test (brief summary)
- Any known issues or areas to watch
- Remind to reload plugin in Obsidian after reset

## Key paths

| Artifact | Location |
|----------|----------|
| npm package | `pi-vault-mind` on npm |
| Plugin repo | `kylebrodeur/obsidian-vault-mind` (BRAT) |
| Test vault | `~/workspace/recycvape/ReturnVape/` |
| Plugin in vault | `<vault>/.obsidian/plugins/vault-mind/` |
| Publish script | `scripts/publish-obsidian-plugin.sh` |
| Reset script | `scripts/reset-test-vault.sh` |
