---
name: vault-mind
description: Universal append-only JSONL collection with LanceDB semantic search, full-text search, graph relationships, and tiered HITL (strict, gated, autopilot). Use when tracking structured facts, decisions, requirements, research, or any append-only record across projects. Supports dynamic context injection into prompts. Install the pi-vault-mind extension first.
---

# pi-vault-mind

Universal append-only JSONL collection with local LanceDB semantic search, graph relationships, and dynamic context injection.

## When to use this skill

- Tracking research findings or verified facts with citations
- Building a decision log with rationale and traceability
- Maintaining a requirements registry
- Any domain where you need append-only structured records with HITL review

## Prerequisites

1. **Embedding provider** — choose one:
   - `@xenova/transformers` — built-in, offline-capable (all-MiniLM-L6-v2, 384 dims)
   - `ollama` — requires Ollama running locally with `embeddinggemma` (768 dims)

2. **pi-vault-mind extension** must be installed:
   ```bash
   pi install npm:pi-vault-mind
   pi -e npm:pi-vault-mind                  # try without installing
   ```

## Quick Start

Run `/vm init` in your project root. This scaffolds:

```
pi-vault-mind.config.json    ← config
.lancedb/                    ← LanceDB vector store (auto-created on first append)
collections/
  main.jsonl                 ← primary collection (JSONL WAL, durable)
  pending.jsonl              ← pending review queue
```

## Commands

All commands are subcommands of `/vm`:

| Command | Purpose |
|---------|---------|
| `/vm init` | Scaffold config, collections, and artifact templates |
| `/vm validate` | Check LanceDB connection, config, and all collection paths |
| `/vm approve [collection]` | Batch-review pending entries (default: main) |
| `/vm settings` | Open interactive settings dashboard |
| `/vm audit` | Audit config for missing defaults |
| `/vm reindex [--all] [--reembed]` | Rebuild FTS + vector indexes |
| `/vm collection select` | Select active collection (shortcut: `ctrl+alt+l`) |
| `/vm collection create` | Interactive wizard to create a new collection |
| `/vm injector create` | Interactive wizard to create a new injector |
| `/vm context status \| enable \| disable` | Manage pi-context integration |
| `/vm embedding status` | Show embedding config + Ollama model availability |
| `/vm embedding use <ollama\|transformers>` | Switch embedding provider |
| `/vm embedding model <name>` | Set Ollama embedding model |
| `/vm embedding models` | List available Ollama models |
| `/vm embedding pull <name>` | Pull a model from Ollama |
| `/vm watcher start \| stop \| status` | Manage passive file watcher |
| `/vm server status` | Show HTTP server health + port |
| `/vm help` | Show usage help |

## Embedding Configuration

### Ollama (higher quality)
```bash
ollama pull embeddinggemma  # default (768 dimensions)

# In Pi:
/vm embedding use ollama
/vm embedding model embeddinggemma
```

### Transformers (offline, zero setup)
Uses `all-MiniLM-L6-v2` (384 dimensions). Downloads ONNX model on first use.
```bash
/vm embedding use transformers   # default
```

## Obsidian Bridge

pi-vault-mind runs an HTTP server on `http://127.0.0.1:11435` (configurable
via `vaultMind.httpPort`). The Vault Mind plugin (or any local automation)
can POST file-save events to `/vault-mind/scan` for explicit, reliable
file-watching instead of relying solely on `fs.watch`.

```bash
# Manual local-bridge trigger:
curl -s -X POST http://127.0.0.1:11435/vault-mind/scan \
  -H "Content-Type: application/json" \
  -d '{"file":"/absolute/path/to/note.md"}'
```

Endpoints:
- `GET /vault-mind/status` — health, uptime, dispatch records
- `POST /vault-mind/scan` — scan a file for `@agent` markers
- `POST /vault-mind/dispatch` — reserved for manual dispatch (future)

## Tools

### vm_search
Semantic vector search across LanceDB-indexed collections.
- `collection` (string, default: "main") — target collection
- `query` (string) — natural-language query
- `limit` (number, optional) — max results (default 5)

### vm_fts_search
Full-text keyword search using Tantivy BM25. Use for exact term/phrase matching.
- `collection` (string, default: "main") — target collection
- `query` (string) — keyword or phrase
- `limit` (number, optional) — max results (default 5)

### vm_graph_query
BFS traversal of entity connections in the graph layer.
- `entity` (string) — entity to find relations for
- `depth` (number, optional, default: 1) — traversal depth

### vm_status
Show LanceDB table sizes and health. No parameters.

### vm_query
Deterministic JSONL search by collection name.
- `collection` (string) — collection name
- `query` (string, optional) — free-text substring search
- `filters` (object, optional) — exact `{field: value}` matches

### vm_append
Append to a collection. Dual-writes to JSONL WAL + LanceDB with auto-embedding.
- `collection` (string) — target collection
- `mode` ("strict" | "gated" | "autopilot") — HITL mode
- `entry` (object) — keys matching the collection schema

### vm_configure
Read or update extension config at runtime.
- `action` ("read" | "update")
- `config` (object, optional for update)

### vm_describe
Introspect schema, entry count, sample entries.
- `collection` (string) — collection name

### vm_stats
Dashboard: counts, sizes, and LanceDB status for all collections. No parameters.

### vm_export
Export to JSON, CSV, or Markdown.
- `collection` (string) — collection name
- `format` ("json" | "csv" | "markdown")

### vm_promote
Promote entries between collections via pending queue.
- `sourceCollection` (string) — source collection
- `targetCollection` (string) — destination collection
- `entryIds` (string[]) — entry IDs to promote
- `reason` (string) — why these entries should be promoted


### Vault link tools (requires Marksman)

When the [Marksman](https://github.com/artempyanykh/marksman) Markdown LSP is installed and on PATH, three extra tools are available for navigating the Obsidian vault:

- `vm_backlinks(note)` — return files that link to the given note (path or title).
- `vm_broken_links()` — return broken `[[wikilinks]]` and relative links via workspace diagnostics.
- `vm_related(entity, depth?)` — return a neighborhood graph of backlinks + forward links around a note. `depth` is clamped to 1-3.

Install Marksman with `dotnet tool install --global marksman`, `brew install marksman`, or download a release from GitHub.

## Configuration

Edit `pi-vault-mind.config.json`. Top-level keys:
- `version` — must be `2`
- `collections` — named collection definitions
- `injectors` — regex triggers for auto-injecting context
- `vaultMind` — LanceDB + embedding + vault settings (replaces the old `qmd` block)

### Collection definition

```json
"main": {
  "path": "collections/main.jsonl",
  "schema": ["id", "domain", "source", "fact", "tag", "artifact"],
  "dedupField": "fact"
}
```

| Key | Description |
|-----|-------------|
| `path` | File path (relative to cwd) |
| `schema` | Ordered field names, or a string referencing another collection |
| `dedupField` | Field checked for duplicates in autopilot mode |

### VaultMind (LanceDB + embedding) settings

```json
"vaultMind": {
  "dataDir": ".lancedb",
  "embedding": {
    "provider": "transformers",
    "ollamaModel": "embeddinggemma",
    "ollamaHost": "http://127.0.0.1:11434"
  },
  "ftsEnabled": true,
  "graph": {
    "enabled": true,
    "canvasSync": false
  }
}
```

| Key | Default | Description |
|-----|---------|-------------|
| `dataDir` | `.lancedb` | LanceDB storage directory |
| `embedding.provider` | `transformers` | `ollama` or `transformers` |
| `embedding.ollamaModel` | `embeddinggemma` | Ollama embedding model name |
| `ftsEnabled` | `true` | Enable Tantivy full-text search |
| `graph.enabled` | `true` | Enable entity/relation extraction |

## Architecture

Dual-write design:
1. **JSONL WAL** — human-readable, crash-safe, version-control-friendly
2. **LanceDB** — local vector database for semantic search + FTS + graph traversal

On append: JSONL write → LanceDB upsert with auto-embedding → entity extraction.

## Workflow

### 1. Scaffold
```
/vm init
/vm validate
```

### 2. Capture facts
```
vm_append(collection="main", mode="gated", entry={
  "id": "REQ-042", "domain": "auth",
  "fact": "Users must authenticate via SSO only", "tag": "login"
})
```

### 3. Search
```
vm_search(collection="main", query="authentication requirements")
vm_fts_search(collection="main", query="SSO")
vm_graph_query(entity="Authentication", depth=2)
```

### 4. Approve pending
```
/vm approve main
```

### 5. Knowledge promotion
```
vm_promote(sourceCollection="research", targetCollection="main", entryIds=["id1"], reason="Broad applicability")
/vm approve
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `LanceDB connection failed` | Verify `vaultMind.dataDir` is writable |
| `Unknown collection` | Run `/vm validate` to see configured collections |
| `Duplicate detected` | Change `dedupField` or provide unique value |
| Injector not firing | Test regex against prompt |
| Ollama not reachable | `/vm embedding status` to diagnose |
