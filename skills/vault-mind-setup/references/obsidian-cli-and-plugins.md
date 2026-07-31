# Obsidian CLI & Plugin Management

This document covers the **safe, official ways** to install and manage Obsidian plugins, themes, and vault state from the terminal. Two CLIs:

- **Official `obsidian` CLI** (1.12+) — requires Obsidian running, full feature parity
- **`notesmd-cli`** (Yakitrak) — headless, no Obsidian required

## Why two CLIs?

| | Official `obsidian` CLI | `notesmd-cli` |
|---|---|---|
| Requires Obsidian running | Yes | No |
| Catalyst license needed | Yes (Early access) | No |
| Plugin install | ✅ `plugin:install` | ❌ (manual or via Obsidian UI) |
| Theme install | ✅ `theme:install` | ❌ |
| Bases | ✅ `bases`, `base:query` | ❌ |
| Tasks | ✅ `tasks`, `task` | ❌ |
| Properties | ✅ `property:set` | ✅ `frontmatter --edit` |
| Files/notes CRUD | ✅ `create`, `append`, `read` | ✅ `create`, `append`, `read` |
| Search | ✅ `search`, `search:context` | ✅ `search-content` |
| Daily notes | ✅ `daily`, `daily:append` | ✅ `daily --content` |
| Sync | ✅ `sync:status`, `sync:history` | ❌ |
| Workspaces | ✅ `workspace:save/load` | ❌ |
| Headless | ❌ | ✅ |

**Use the official CLI when Obsidian is running and you need full feature parity (plugin/theme install, Bases, tasks, sync).**

**Use `notesmd-cli` when Obsidian is not running, or in CI/containers/agent environments where the GUI isn't available.**

## Installing the official Obsidian CLI

1. Update to Obsidian 1.12+ via the official installer (Catalyst license required for Early access).
2. Open Obsidian → **Settings → General → Command line interface** → enable.
3. Follow the prompt to register the CLI to your system PATH. This requires admin privileges:
   - **macOS**: creates `/usr/local/bin/obsidian` symlink via system dialog
   - **Windows**: adds `Obsidian.com` terminal redirector
   - **Linux**: copies binary to `~/.local/bin/obsidian` (make sure it's in PATH)
4. Restart your terminal.
5. Verify: `obsidian help`, `obsidian version`.

Reference: https://help.obsidian.md/cli

## Installing `notesmd-cli`

```bash
# macOS / Linux
brew tap yakitrak/yakitrak
brew install yakitrak/yakitrak/notesmd-cli

# Windows
scoop bucket add scoop-yakitrak https://github.com/yakitrak/scoop-yakitrak.git
scoop install notesmd-cli

# Arch
yay -S notesmd-cli-bin

# From source (requires Go 1.19+)
git clone https://github.com/Yakitrak/notesmd-cli.git
cd notesmd-cli && go build -o notesmd-cli .
sudo install -m 755 notesmd-cli /usr/local/bin/
```

## Plugin install — the safe path

### Via official CLI (Obsidian running)

```bash
# Disable restricted mode if needed
obsidian plugins:restrict off

# Install + enable in one step
obsidian plugin:install id=obsidian-git enable
obsidian plugin:install id=obsidian-breadcrumbs enable
obsidian plugin:install id=graph-analysis enable
obsidian plugin:install id=actions-uri enable
obsidian plugin:install id=obsidian-pi-vault-mind enable
obsidian plugin:install id=obsidian42-brat enable   # for beta plugins

# Verify
obsidian plugins:enabled filter=community
```

The plugin IDs are the **GitHub repo name** (lowercase, kebab-case), e.g., `obsidian-git` for `Vinzent03/obsidian-git`.

### Via Obsidian UI

Settings → Community Plugins → Browse → search → Install → Enable.

### Via BRAT (for beta plugins not in the store)

1. Install BRAT first: `obsidian plugin:install id=obsidian42-brat enable`
2. In Obsidian: Settings → BRAT → **Beta Plugin List** → **Add Beta Plugin**
3. Paste the GitHub URL of the beta plugin (e.g., `https://github.com/zsviczian/obsidian-excalidraw-plugin`)
4. Click **Add Plugin** → Enable

BRAT will keep the plugin updated when new commits are pushed to the source repo.

## Theme install

```bash
# Browse themes via official CLI
obsidian themes

# Install + activate
obsidian theme:install name="Minimal" enable
obsidian theme:install name="AnuPpuccin" enable

# Set as active
obsidian theme:set name="Minimal"

# Check current
obsidian theme
```

## Workspace management

The Workspaces plugin (built-in 1.12+) lets you save and load pane layouts:

```bash
# Set up your workspaces
obsidian workspace:save name="Inbox"
obsidian workspace:save name="Research"
obsidian workspace:save name="Code"

# List saved
obsidian workspaces

# Switch
obsidian workspace:load name="Research"

# Delete
obsidian workspace:delete name="OldLayout"
```

## Bases

The official CLI has first-class Bases support:

```bash
# List all .base files
obsidian bases

# List views in a base
obsidian base:views file=Tasks.base

# Query a base (returns JSON)
obsidian base:query file=Tasks.base view="By Status" format=json

# Create new item in a base view
obsidian base:create file=Tasks.base view="Inbox" name="New Task" content="- [ ] Task body"
```

## Tasks

```bash
# List all incomplete tasks
obsidian tasks todo

# List tasks from today's daily note
obsidian tasks daily todo

# Toggle a task (file:line reference)
obsidian task ref="Note.md:8" toggle

# Mark done / todo
obsidian task file=Note line=8 done
obsidian task file=Note line=8 todo
```

## Properties (typed YAML frontmatter)

```bash
# Read a property
obsidian property:read name="status" file=Note.md

# Set a property with type
obsidian property:set name="status" value="done" type=text path=Note.md
obsidian property:set name="agent:related-to" value="[[X]]" type=list path=Note.md

# Remove
obsidian property:remove name="draft" file=Note.md
```

## Syncing

```bash
# Check status
obsidian sync:status

# List history for a file
obsidian sync:history file=Note.md

# Read a specific version
obsidian sync:read file=Note.md version=3

# Restore
obsidian sync:restore file=Note.md version=3

# Pause / resume
obsidian sync off
obsidian sync on
```

## Headless workflow with `notesmd-cli`

When Obsidian isn't running (CI, agent environment, headless server):

```bash
# Register a vault
notesmd-cli add-vault /home/user/Vaults/main --set-default

# Create a note
notesmd-cli create "Agent/Inbox/2026-06-06-test.md" \
  --content "# Test note

This is a test." --overwrite

# Append
notesmd-cli create "Agent/Inbox/2026-06-06-test.md" \
  --content "Appended text" --append

# Read
notesmd-cli print "Agent/Inbox/2026-06-06-test.md"

# Set frontmatter
notesmd-cli frontmatter "Note.md" --edit --key "status" --value "done"

# Search
notesmd-cli search-content "pi-vault-mind" --format json --no-interactive

# Move/rename
notesmd-cli move "old.md" "new.md"
```

## When to use which

| Scenario | Use |
|---|---|
| User has Obsidian open, wants to install plugins | Official `obsidian plugin:install` |
| Agent (pi) needs to read/write vault files | Either, but `notesmd-cli` works without Obsidian open |
| CI / cron job | `notesmd-cli` |
| Working with Bases | Official `obsidian base:*` |
| Need to manage Obsidian Sync | Official `obsidian sync:*` |
| User on Windows without Catalyst license | `notesmd-cli` (headless alternative) |
| Setting up workspaces | Official `obsidian workspace:*` |

## Notes for the `kb-2024` vault

The user's `kb-2024` vault (at `/mnt/c/users/kyleb/iCloudDrive/Documents/Vaults/kb-2024/`) has 23 community plugins. Most are compatible. Notable ones to be aware of:

| Plugin | ID | Notes |
|---|---|---|
| `obsidian42-brat` | `obsidian42-brat` | How they got beta plugins like excalidraw, mermaid-popup, etc. |
| `obsidian-tasks-plugin` | `obsidian-tasks-plugin` | Use `obsidian task` CLI commands to toggle |
| `obsidian-excalidraw-plugin` | `obsidian-excalidraw-plugin` | BRAT-installed; embed `.excalidraw.md` in syntheses |
| `mermaid-popup` | `mermaid-popup` | Render Mermaid diagrams in pages |
| `obsidian-style-settings` | `obsidian-style-settings` | Vault-wide theming |
| `cmdr` | `cmdr` | Custom command palette — useful for agent triggers |
| `make-md` | `make-md` | Markdown automation — pairs with Templater |

## Safety rails

- **`obsidian plugin:install enable`** is idempotent — safe to re-run
- **`obsidian plugin:disable`** is reversible — no data loss
- **`obsidian delete file=X permanent`** is the only destructive command — defaults to trash
- **`notesmd-cli create --overwrite`** is destructive — confirm before running
- **`notesmd-cli delete`** is destructive — confirm before running

Always show the user the command before running anything that modifies or deletes files. Use `--dry-run` flags where available (the official CLI doesn't have one, but `notesmd-cli` for some commands like `frontmatter --print` is read-only).
