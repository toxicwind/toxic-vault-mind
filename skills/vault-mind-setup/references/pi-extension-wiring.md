# pi Extension Wiring

This document describes every pi extension and external tool that **pi-vault-mind** integrates with.

## Required Extensions

### pi-context

**What it provides:** Context hygiene tools (`context_tag`, `context_log`, `context_checkout`).

```bash
pi install npm:pi-context
```

**How we use it:**
- Session hygiene for the Manager agent
- Checkpoint tracking for dispatched agent tasks
- Context isolation between vault-mind sessions

**Configuration:** None required. Works out of the box.
### pi-context

**What it provides:** Context management tools (`context_tag`, `context_log`, `context_checkout`) for clean session hygiene during long orchestration sessions.

```bash
pi install npm:pi-context
```

**How we use it:**
- Manager tags milestones (`watcher-build-start`, `research-phase`) to create rollback points
- Before risky operations, checks `context_log` to understand current session state
- After noisy research: squashes history with `context_checkout` to keep context window clean

**Configuration in `pi-vault-mind.config.json`:**
```json
{
  "extensionCompatibility": {
    "pi-context": {
      "enabled": true,
      "tagPatterns": [],
      "enhanceInjectors": false,
      "autoEnableAcm": true,
      "indexContextEvents": true
    }
  }
}
```

Enable/disable via:
```
/vm context enable
/vm context disable
/vm context status
```

## Optional Extensions

### NotebookLM CLI (`nlm`)

**What it provides:** Command-line interface to Google NotebookLM for programmatic podcast generation, study guides, quizzes, and audio overviews.

```bash
# Install globally (not a pi extension):
npm install -g notebooklm-cli

# Or use the MCP server (preferred):
# Add to ~/.pi/agent/mcp.json:
# { "notebooklm-mcp": { "command": "npx", "args": ["-y", "notebooklm-mcp-cli"] } }
```

**How we use it (Broadcaster agent):**
- User drops `@agent-broadcaster` on meeting notes
- Broadcaster creates NotebookLM notebook from vault markdown files
- Generates "Deep Dive" audio overview
- Downloads `.wav` to `Vault/Agent/Presentations/`

**Required skill:** `nlm-skill` — auto-loaded by pi when `nlm` or `notebooklm` keywords are detected.

**Authentication:** Requires Google account login. Run once:
```bash
nlm login
```

### any2md

**What it provides:** Converts URLs, PDFs, and other formats to clean markdown. Used by the Miner for passive document ingestion.

```bash
# Available via npx (no global install needed):
npx any2md https://arxiv.org/abs/... > paper.md

# Or install globally:
npm install -g any2md
```

**How we use it (Miner agent):**
- User drops a PDF URL or file reference with `@agent-miner ingest`
- Miner calls `npx any2md <source>` to convert to markdown
- Extracts entities and appends to LanceDB
- Writes converted markdown to `Vault/Agent/Inbox/`

### kepano/obsidian-skills

**What it provides:** Five pi skills that teach agents Obsidian-specific formats.

Install via:
```bash
# Clone or copy to ~/.pi/agent/skills/
git clone https://github.com/kepano/obsidian-skills ~/.pi/agent/skills/obsidian-skills

# Or install individual skills as pi packages
pi install git:https://github.com/kepano/obsidian-skills
```

The 5 skills:
- `obsidian-markdown` — Obsidian-flavored markdown syntax
- `obsidian-bases` — `.base` file format (database views)
- `json-canvas` — Canvas JSON format
- `obsidian-cli` — official Obsidian CLI
- `defuddle` — cleaner markdown extraction from web pages

**Why required:** Without these skills, agents generate technically-valid markdown that Obsidian doesn't render correctly. The skills teach them wikilinks, embeds, callouts, Bases, and Canvas.

## Extension Dependency Graph

pi-vault-mind
├── REQUIRED: pi-context          → context_tag/log/checkout for session hygiene
├── OPTIONAL: notebooklm-mcp-cli  → Broadcaster audio generation (nlm-skill)
├── OPTIONAL: any2md              → Miner passive document ingestion
├── OPTIONAL: pi-intercom         → inter-agent coordination channel
└── OPTIONAL: kepano/obsidian-skills  → agents learn Obsidian formats

## Quick Install (all at once)

```bash
# Core (required)
pi install npm:pi-vault-mind
pi install npm:pi-context

# Optional quality-of-life
npm install -g notebooklm-cli    # or configure MCP server
npm install -g any2md             # or use npx any2md

# Obsidian skills (agents learn Obsidian format)
git clone https://github.com/kepano/obsidian-skills ~/.pi/agent/skills/obsidian-skills

# Verify
pi -e npm:pi-vault-mind
/vm validate
/vm watcher status
```

## Global Config Template

After installing all extensions, create `~/.pi/agent/pi-vault-mind.config.json`:

```json
{
  "version": 2,
  "vaultMind": {
    "dataDir": ".lancedb",
    "embedding": {
      "provider": "transformers",
      "ollamaModel": "embeddinggemma",
      "ollamaHost": "http://127.0.0.1:11434"
    },
    "graph": {
      "enabled": true,
      "canvasSync": true
    },
    "vaults": {
      "default": {
        "path": "/home/YOU/Obsidian/YOUR_VAULT",
        "autoSync": true,
        "autoSyncTags": ["decision", "insight", "requirement"],
        "autoSyncMinLength": 200
      }
    }
  },
  "extensionCompatibility": {
    "pi-context": {
      "enabled": true,
      "tagPatterns": [],
      "autoEnableAcm": true
    }
  },
  "collections": {},
  "injectors": []
}
```

## How Extensions Wire Together at Runtime

```
1. pi starts with pi-vault-mind loaded
   ├── Discovers skills/ directory → Manager, Miner, Broadcaster, Heavy-Lifter prompts
   ├── Registers 12 vault-mind tools (vm_search, vm_append, vm_sync, etc.)
   ├── Registers /vm commands (init, validate, watcher, etc.)
   └── Auto-starts Vault Watcher if vaultMind.vaults is configured

2. User saves @agent-miner in Obsidian
   ├── Vault Watcher (src/watcher.ts) detects marker via fs.watch
   ├── Groups markers, debounces 1s
   └── Publishes JOB_AVAILABLE to internal MessageBus

3. Manager agent receives JOB_AVAILABLE
   ├── Claims the task via TaskQueue
   ├── Executes via invokePiTool() through the bridge
   └── pi-context tools available for session hygiene (context_tag, etc.)

4. Miner agent executes in isolation
   ├── Reads the vault file (instruction + context)
   ├── If URL/PDF detected: calls npx any2md to convert
   ├── Extracts entities via regex (src/graph.ts)
   ├── Calls vm_append() → JSONL WAL + LanceDB
   ├── Calls vm_sync() → markdown in Vault/Agent/Inbox/
   └── Terminates — context doesn't pollute Manager session

## Troubleshooting

| Symptom | Check |
|---|---|
| `context_tag is not defined` | Install pi-context: `pi install npm:pi-context` |
| Watcher doesn't start | Vaults not configured: add `vaultMind.vaults` to config |
| Agent doesn't run | Check `/vm watcher status` — is it RUNNING? Check vault path |
| NotebookLM fails | `nlm login` to authenticate Google account |
| any2md fails | Use `npx any2md` or install globally: `npm install -g any2md` |
