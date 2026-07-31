# pi-vault-mind Tool Reference

## Tools (LLM-accessible)

| Tool | Purpose | Search Type |
|------|---------|-------------|
| `vm_search` | Semantic vector search | Vector (cosine similarity) |
| `vm_fts_search` | Full-text keyword search | Tantivy BM25 |
| `vm_graph_query` | Entity relationship traversal | Graph BFS |
| `vm_status` | LanceDB table health | Metadata |
| `vm_query` | JSONL deterministic search | Substring + exact filters |
| `vm_append` | Dual-write: JSONL + LanceDB | Insert with auto-embed |
| `vm_configure` | Read/update config | Config |
| `vm_describe` | Introspect collection schema + stats | Metadata |
| `vm_stats` | Dashboard for all collections | Metadata |
| `vm_export` | Export to JSON/CSV/Markdown | Read |
| `vm_promote` | Stage entries for cross-collection promotion | Write |

## Commands

| Command | Handler |
|---------|---------|
| `/vm init` | Scaffold config + collections |
| `/vm validate` | Health check |
| `/vm approve [collection]` | Batch-review pending |
| `/vm settings` | Interactive settings dashboard |
| `/vm audit` | Config audit + repair |
| `/vm reindex [--all] [--reembed]` | Rebuild FTS/vector indexes |
| `/vm collection select` | Select active collection |
| `/vm collection create` | Create new collection (wizard) |
| `/vm injector create` | Create new injector (wizard) |
| `/vm context status \| enable \| disable` | Manage pi-context |
| `/vm embedding status \| use \| model \| models \| pull` | Embedding management |
| `/vm watcher start \| stop \| status` | Manage file watcher |
| `/vm server status` | HTTP server health + port |
| `/vm help` | Show usage help |

## Internal Modules

### lance.ts
- `connect(dataDir)` — LanceDB connection (cached)
- `upsertEntry(dataDir, collectionName, entry, cfg)` — Insert with auto-embed
- `searchHybrid(dataDir, collectionName, query, limit, cfg)` — Vector search
- `searchFts(dataDir, collectionName, query, limit, cfg)` — Pure FTS search
- `getStatus(dataDir)` — Table health report
- `testOllamaConnection(pi)` — Multi-path Ollama reachability
- `discoverOllamaModels(pi)` — Model discovery via pi.exec/HTTP/models.json
- `pullOllamaModel(model, pi)` — Pull via pi.exec/HTTP

### server.ts
- `startServer(pi, serverState, watcherState)` — Start HTTP server on `127.0.0.1`
- `stopServer(serverState)` — Graceful shutdown
- Endpoints: `/vault-mind/status` (GET), `/vault-mind/scan` (POST), `/vault-mind/dispatch` (POST)
