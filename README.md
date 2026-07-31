# pi-vault-mind

[![npm version](https://img.shields.io/npm/v/pi-vault-mind)](https://www.npmjs.com/package/pi-vault-mind)
[![license](https://img.shields.io/npm/l/pi-vault-mind)](LICENSE)
[![pi-extension](https://img.shields.io/badge/pi-extension-blue)](https://github.com/mariozechner/pi)

Passive Obsidian vault extension for the [pi](https://github.com/mariozechner/pi) agent ecosystem. Watches `@agent` markers in your vault, dispatches forked subagents, and stores results in LanceDB with vector + FTS + graph. Multi-agent "Drop & Forget" workflow.

> Looking for the legacy ledger-first extension (predecessor project)?
> See [kylebrodeur/pi-qmd-ledger](https://github.com/kylebrodeur/pi-qmd-ledger).
> This project was renamed twice: `pi-qmd-ledger` → `pi-knowledge-store` (intermediate) → `pi-vault-mind` (current).

## Features

- **Passive File Watcher** — drop `@agent-Miner`, `@agent-Broadcaster`, etc. in any Obsidian note. Save the file. The watcher detects the marker, groups by role, and dispatches isolated subagent forks (`vault-mind-{role}` agents). No chat pollution, no manual triggers.
- **Multi-Agent Architecture** — five specialist agents under the `vault-mind-{role}` skill naming: **Manager** (interactive orchestrator), **Miner** (research + entity extraction), **Broadcaster** (NotebookLM artifacts), **Heavy-Lifter** (external delegation), **Watcher** (passive file observer).
- **LanceDB Vector + FTS + Graph** — hybrid semantic + keyword search with automatic entity extraction and BFS graph traversal. All local, no external binaries.
- **JSONL Source-of-Truth + LanceDB Index** — every fact lives in a durable, human-readable, version-control-friendly `collections/*.jsonl` file. The LanceDB index is derived and rebuildable via `/vm reindex --all --reembed`.
- **Bidirectional Obsidian Sync** — substantial entries (`>200 chars` or tagged `decision`/`insight`/`requirement`) auto-write to `Vault/Agent/Inbox/`. Graph entities render as Obsidian Canvas files.
- **Vault-Scoped Configuration Surface** — Vault Mind setup/config now lives under `<vault>/.vault-mind/`, with the Obsidian setup wizard and `/vm setup` both writing the vault-local surface instead of a shared global config.
- **Interactive Setup Wizard** — the Obsidian setup wizard handles first-run runtime/install/provider/folder/preferences/review flow, and `/vm setup` remains available for CLI/repair use.

## Architecture

```
┌─────────────────────────────────────────┐
│  User prompt                             │
│  e.g. "draft login"                      │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Injector regex match                    │
│  → matches "draft\s+(\S+)"              │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  query collections/main.jsonl            │
│  where tag="login" + inject artifact.md  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Appended to system prompt               │
│  → LLM now has pre-fetched context       │
└─────────────────────────────────────────┘

Data Layer:
┌─────────────────────────────────────────┐
│  JSONL WAL (collections/*.jsonl)        │
│  ─ durable, human-readable, versionable │
│       │                                  │
│       ▼ (auto-embed on append)           │
│  LanceDB (.lancedb/)                    │
│  ─ vector search + FTS + graph          │
│       │                                  │
│       ▼ (graph extraction)               │
│  Graph Tables (entities + relations)     │
│  ─ entity linking + traversal            │
└─────────────────────────────────────────┘
```

See [`docs/architecture/index.md`](docs/architecture/index.md) for the full agent flow.

## Obsidian Counterparts & Requirements

pi-vault-mind works on any directory, but for the **full Obsidian experience**, you need a few things in Obsidian itself:

### Required: An Obsidian vault
Just point `/vm setup` at any directory used as an Obsidian vault. pi-vault-mind auto-detects `.obsidian/` and respects `.obsidian/`, `.git/`, `.trash/`.

### Recommended: Official Obsidian CLI (1.12+)

The [official Obsidian CLI](https://help.obsidian.md/cli) lets you install plugins, themes, and manage vault state from the terminal. **This is the safest, most direct install path** for pi-vault-mind's required plugins.

Install: Open Obsidian → **Settings → General → Command line interface** → enable. Follow the prompt to register the CLI to your system PATH. Restart your terminal. Test: `obsidian help`.

Then run:
```bash
obsidian plugin:install id=obsidian-git enable
obsidian plugin:install id=obsidian-breadcrumbs enable
obsidian plugin:install id=graph-analysis enable
obsidian plugin:install id=actions-uri enable
obsidian plugin:install id=obsidian42-brat enable
obsidian plugin:install id=obsidian-pi-vault-mind enable

Full walkthrough: see [`docs/integrations/OBSIDIAN_SETUP.md`](docs/integrations/OBSIDIAN_SETUP.md).

### Recommended: Obsidian Community Plugins

| Plugin | Install ID | Why | Status |
|---|---|---|---|
| **obsidian-git** | `obsidian-git` | Auto-commits vault changes for backup & conflict resolution. Heavy-Lifter uses git worktrees for isolated refactors. | Essential |
| **Breadcrumbs** | `obsidian-breadcrumbs` | Parses typed edges (`agent:related-to`, `agent:derived-from`) in YAML frontmatter. The recommended way to display the agent-extracted knowledge graph in Obsidian's UI. | Highly recommended |
| **Graph Analysis** | `graph-analysis` | Co-citation discovery, Jaccard similarity on the native Obsidian graph. Surfaces "always cited together but not yet linked" notes — a key agent discovery signal. | Highly recommended |
| **Actions URI** | `actions-uri` | `x-callback-url` endpoints so the Manager agent can trigger Obsidian UI commands (open notes, run commands) from pi. | Recommended |
| **Vault Mind plugin** | `obsidian-pi-vault-mind` | Native setup/status/chat UI and HTTP bridge integration. | Recommended |

### Recommended: `notesmd-cli` (headless alternative)

For headless operations, CI, or when Obsidian isn't running, use [Yakitrak/notesmd-cli](https://github.com/Yakitrak/notesmd-cli). It does everything the official CLI does but doesn't require Obsidian to be open.

```bash
brew tap yakitrak/yakitrak && brew install yakitrak/yakitrak/notesmd-cli
# or scoop, AUR, etc.

notesmd-cli add-vault /path/to/vault
notesmd-cli create "Note.md" --content "..." --append
```

Use the official `obsidian` CLI when Obsidian is running; use `notesmd-cli` when it isn't.

### Beta plugins via BRAT

For beta plugins not in the official store:

```bash
# Install BRAT first
obsidian plugin:install id=obsidian42-brat enable

# Then add beta plugin URLs via BRAT's interface, or:
# In Obsidian: Settings → BRAT → Beta Plugin List → Add
```

### Recommended: kepano/obsidian-skills (pi skills)

Install via the official [`skills` CLI](https://github.com/vercel-labs/skills)
(pi is a first-class target agent — auto-detected):

```bash
# Non-interactive: install all 5 globally for pi
DISABLE_TELEMETRY=1 yes y | npx -y skills add https://github.com/kepano/obsidian-skills \
  --skill obsidian-markdown --skill obsidian-bases \
  --skill json-canvas --skill obsidian-cli --skill defuddle \
  -g -a pi --copy -y
```

This puts them at `~/.pi/agent/skills/<name>/SKILL.md` where pi
auto-discovers them. The CLI handles agent detection, symlink/copy,
and security risk confirmations.

**Verify they're discoverable:**

```bash
for s in obsidian-markdown obsidian-bases json-canvas obsidian-cli defuddle; do
  [ -f ~/.pi/agent/skills/$s/SKILL.md ] && echo "✅ $s" || echo "❌ $s"
done
```
- `obsidian-markdown` — agent learns Obsidian-flavored markdown syntax
- `obsidian-bases` — agent learns to generate valid `.base` files (database views)
- `json-canvas` — agent learns Canvas JSON format (used for our graph sync)
- `obsidian-cli` — agent learns to use the Obsidian CLI
- `defuddle` — cleaner markdown extraction from web pages

These skills let the **Miner, Broadcaster, and Heavy-Lifter agents** produce valid Obsidian content.

### Built-in Obsidian features used

| Feature | How pi-vault-mind uses it |
|---|---|
| **YAML frontmatter properties** | Strict schema for typed edges (`agent:related-to`, `status: needs-podcast`, `domain:`, `tag:`) |
| **Callouts** | `> [!info]`, `> [!warning]` for syntheses and contradictions |
| **Embeds** | `![[Note]]` to transclude summaries into synthesis docs |
| **Obsidian Bases (`.base`)** | Agent-generated dynamic tables/boards/kanbans in `Agent/Tasks/` |
| **JSON Canvas (`.canvas`)** | `vm_sync(format="canvas")` writes entity graph as Canvas JSON |
| **Obsidian Sync** | Primary sync mechanism across devices |

### Optional: NotebookLM integration (Broadcaster)

The Broadcaster agent can generate podcasts, study guides, and slide decks from vault content via the [notebooklm-mcp-cli](https://github.com/jacob-bd/notebooklm-mcp-cli) MCP server. Requires Google account login.

---

## Quick Start

### Prerequisites

- **Node.js** 20+ (matches `engines` in `package.json`)
- **Embedding Provider** — choose one:
  - `@xenova/transformers` — built-in, no external deps (uses all-MiniLM-L6-v2, offline-capable)
  - `ollama` — requires Ollama running locally with `embeddinggemma` (higher quality)
  - `modal` — optional, **bring-your-own deploy**: offload embedding + bulk re-index to a cloud GPU service and sync vectors down for offline search (see [docs/integrations/MODAL_EMBEDDING.md](docs/integrations/MODAL_EMBEDDING.md)). Default behavior is unchanged until you opt in.

> **On the Modal provider:** the local providers above work for everyone with
> zero infrastructure — that's the default. `modal` is an **optional, self-hosted
> tier**: you deploy your own copy of the service (`uvx modal deploy modal/app.py`
> from a clone of this repo) to your own Modal account and point the extension at
> *your* URL + token. There is no shared/hosted endpoint — a deployment's URL and
> bearer token are private to whoever owns it. (A standalone PyPI package for the
> server may come later.)

### 1. Install with pi

```bash
pi install npm:pi-vault-mind              # latest
pi install npm:pi-vault-mind@0.7.0        # pinned
pi -e npm:pi-vault-mind                   # try without installing
```

Or from git:

```bash
pi install git:git@github.com:kylebrodeur/pi-vault-mind
```

### 2. Configure (interactive wizard)

```
/vm setup
```

This configures the current vault's setup surface: vault path, embedding
provider details, folder layout, and scaffolding.

Or via CLI for scripting/repair:

```bash
/vm setup --vault /home/you/Obsidian/MyVault --remoteUrl https://your-embedding-service-url.example.com --model embeddinggemma
```

Config is written to the vault-local Vault Mind surface under
`<vault>/.vault-mind/` rather than a shared global config file.

You can re-run `/vm setup` anytime to view or change settings, and the
Obsidian plugin's setup wizard uses the same extension-owned routes.

### 3. Start using

```
vm_append(collection="main", mode="autopilot", entry={"id":"1","domain":"auth","fact":"JWT tokens expire after 1 hour","tag":"security"})
vm_search(collection="main", query="token expiry")
```

Entries are automatically embedded and stored in LanceDB. If graph is enabled, entities and relations are also extracted.

### 4. Adapt the config

Edit `<vault>/.vault-mind/vault-mind.config.json` to match your domain:

```json
{
  "version": 2,
  "collections": {
    "main": {
      "path": "collections/main.jsonl",
      "schema": ["id", "domain", "source", "fact", "tag", "artifact"],
      "dedupField": "fact"
    }
  },
  "injectors": [
    {
      "name": "draft-context",
      "regex": "draft\\s+(\\S+)",
      "collection": "main",
      "filterField": "tag"
    }
  ],
  "vaultMind": {
    "dataDir": ".lancedb",
    "embedding": {
      "remoteUrl": "http://127.0.0.1:11434",
      "model": "embeddinggemma",
      "dim": 768
    },
    "ftsEnabled": true,
    "graph": { "enabled": true, "canvasSync": false }
  }
}
```

## Example domains

### Research project

```json
{
  "collections": {
    "findings": {
      "path": "research/findings.jsonl",
      "schema": ["id", "paper", "claim", "evidence", "confidence", "tag"],
      "dedupField": "claim"
    }
  },
  "injectors": [
    {
      "name": "lit-review",
      "regex": "review\\s+(\\S+)",
      "collection": "findings",
      "filterField": "tag",
      "artifactPath": "research/synthesis.md"
    }
  ]
}
```

### Decision log

```json
{
  "collections": {
    "decisions": {
      "path": "decisions/log.jsonl",
      "schema": [
        "id",
        "date",
        "context",
        "decision",
        "rationale",
        "status",
        "owner"
      ],
      "dedupField": "decision"
    }
  },
  "injectors": [
    {
      "name": "decide",
      "regex": "decide\\s+(\\S+)",
      "collection": "decisions",
      "filterField": "context"
    }
  ]
}
```

## Tools

| Tool               | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `vm_search`       | Semantic search via LanceDB (vector + FTS)       |
| `vm_fts_search`    | Exact keyword full-text search (Tantivy BM25)      |
| `vm_graph_query`  | Traverse entity connections in the graph layer          |
| `vm_status`       | Show LanceDB table sizes and health                     |
| `vm_query`      | Deterministic JSONL search by collection name           |
| `vm_append`     | Append with strict/gated/autopilot modes + dual-write   |
| `vm_configure`  | Read or update config at runtime                        |
| `vm_describe`   | Introspect schema, count, and sample entries            |
| `vm_stats`      | Dashboard: counts, sizes, LanceDB status                |
| `vm_export`     | Export to JSON, CSV, or Markdown                        |
| `vm_promote`    | Promote entries between collections via pending queue  |

## Commands

| Command                        | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `/vm help`                   | Show usage help                                          |
| `/vm setup`                  | Interactive vault-local setup/config wizard (runtime, embedding, scaffold) |
| `/vm validate`               | Health check LanceDB, config, and all collection paths   |
| `/vm approve [collection]`   | Batch-review pending entries                              |
| `/vm settings`               | Open interactive settings dashboard                       |
| `/vm audit`                  | Audit config for missing defaults                         |
| `/vm reindex [--all] [--reembed] [--remote]` | Rebuild FTS + vector indexes; `--remote` offloads to Modal |
| `/vm collection select`      | Select active collection (shortcut: ctrl+alt+l)          |
| `/vm collection create`      | Interactive wizard to create a new collection              |
| `/vm injector create`        | Interactive wizard to create a new injector                |
| `/vm context enable \| disable \| status` | Manage pi-context integration              |
| `/vm embedding status \| use \| model \| models \| pull` | Manage embedding provider |
| `/vm remote status \| config \| sync \| jobs \| migrate` | Manage remote embedding + vector sync |
| `/vm watcher start \| stop \| status` | Manage the passive file watcher                  |
| `/vm server status` | Show HTTP server status, port, and uptime |

## Documentation

Documentation is maintained directly in this repository.

### Getting started

| Doc | Description |
|---|---|
| [Install playbook](docs/_reference/reference_archive/getting-started/INSTALL.md) | Canonical install procedure for the extension, skills, Obsidian plugin, configuration, and external CLIs |
| [Getting started](docs/_reference/reference_archive/getting-started/GETTING_STARTED.md) | End-to-end setup and daily “drop and forget” workflow |
| [CLI-only walkthrough](docs/_reference/reference_archive/getting-started/CLI_ONLY_WALKTHROUGH.md) | Setup and daily commands without the Obsidian plugin |
| [ReturnVape walkthrough](docs/getting-started/WALKTHROUGH.md) | Current guided Obsidian test-vault procedure |

### Architecture & design

| Doc | Description |
|---|---|
| [docs/architecture/AGENTS.md](docs/architecture/AGENTS.md) | Agent Roster and Multi-Agent Architecture ("Fork & Review" model) |
| [docs/architecture/EXTENSION_WIRING.md](docs/architecture/EXTENSION_WIRING.md) | Extension dependencies, runtime wiring, auto-install patterns |
| [docs/architecture/DISPATCHER_SPEC.md](docs/architecture/DISPATCHER_SPEC.md) | Technical spec for the passive file-watcher and subagent routing — incl. the "Fork & Dispatch" rationale and thread resume |

### Modal embedding service (local integration done)

The local extension now integrates the Modal embedding service as a fully
configurable embedding provider: on-demand `/embed` for search (with an offline
fallback that degrades to FTS, never crashes), a sync-down path that pulls
server-side vectors into the local LanceDB with a monotonic `seq` watermark,
remote bulk re-index (`/vm reindex --all --reembed --remote`), and debounced +
batched append embedding via the coalescer. Existing non-modal users see no
behavior change. See [docs/integrations/MODAL_EMBEDDING.md](docs/integrations/MODAL_EMBEDDING.md) for the
full design.

| Doc | Description |
|---|---|
| [docs/integrations/MODAL_EMBEDDING.md](docs/integrations/MODAL_EMBEDDING.md) | Design of record: ADRs, HTTP contract, sync protocol, roadmap for the cloud embedding service |
| [modal/](modal/) | The deployable Modal app: embedding service + bulk worker + sync + dataset generator |
| [eval/](eval/) | Retrieval eval harness + labeled benchmark datasets for picking the canonical model |

### Reference

| Doc | Description |
|---|---|
| [skills/vault-mind/SKILL.md](skills/vault-mind/SKILL.md) | The Manager skill — what pi auto-loads about this extension |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Version history (rename from `pi-knowledge-store` to `pi-vault-mind` was v0.7.0) |
| [Tools reference](docs/_reference/reference_archive/tools.md) | Registered Vault Mind tools, parameters, and return shapes |
| [Commands reference](docs/_reference/reference_archive/commands.md) | Full `/vm` slash command tree |
| [Setup and configuration](docs/reference/setup-and-configuration.md) | Current integrated setup/configuration surface, ownership, routes, and live gaps |
| [Skill manifest](docs/_reference/reference_archive/skill.md) | Bundled skills and their trigger phrases |

### Development

| Doc | Description |
|---|---|
| [docs/development/CONTRIBUTING.md](docs/development/CONTRIBUTING.md) | Dev setup, testing, and commit conventions |
| [docs/development/PUBLISHING.md](docs/development/PUBLISHING.md) | How to publish this extension to npm |

### Archive

| Doc | Description |
|---|---|
| [docs/_archive/](docs/_archive/) | Historical docs kept for context (e.g. the `pi-knowledge-store` → `pi-vault-mind` rename audit) |
| [docs/_archive/legacy-audit.md](docs/_archive/legacy-audit.md) | The 2026-06-08 legacy-terminology audit (139 findings, 13 blockers) and its resolution log. Resolved 2026-06-09 and archived 2026-06-16. |

## Contributing

See [docs/development/CONTRIBUTING.md](docs/development/CONTRIBUTING.md) for dev setup, testing, and commit conventions.

## License

MIT — see [LICENSE](LICENSE) (or package.json).
