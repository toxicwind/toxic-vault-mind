---
name: github-release-notes-file
description: Create GitHub releases with multi-line notes by writing to a file and using gh --notes-file
---

# GitHub Release Notes — Use `--notes-file`

When you need multi-line markdown release notes, **do not** use inline `--notes` with `\n` escapes. Bash keeps the backslashes literal, and the release notes will display `\n` on GitHub.

## Recommended pattern

1. Create the notes file with the `write` tool:

   Path: `/tmp/release-notes-vX.Y.Z.md`

   Content:
   ```markdown
   ## What's new

   - Feature one
   - Feature two

   ## Known issues

   - Issue one
   ```

2. Create the release with `--notes-file`:

```bash
gh release create vX.Y.Z --title "vX.Y.Z" --notes-file /tmp/release-notes-vX.Y.Z.md
```

3. To edit an existing release:

```bash
gh release edit vX.Y.Z --notes-file /tmp/release-notes-vX.Y.Z.md
```

## Why not inline?

Double-quoted shell strings do not interpret `\n` as a newline. `$'...'` or `printf` can work, but they are fragile for markdown containing quotes and backticks. The bash tool also blocks `cat > file <<'EOF'` redirects for file creation, so use the `write` tool instead.
