# Troubleshooting Tree

When something is wrong, follow this decision tree. **Read the error message first — it usually tells you which branch to take.**

## Step 1: Identify the layer

| Symptom category | Likely layer | First check |
|---|---|---|
| "command not found", "is not defined" | pi extension not installed | `pi list` |
| "connection refused", "ECONNREFUSED" | External service down (Ollama, LanceDB) | `ollama list`, `ls $dataDir` |
| "permission denied" | Filesystem permissions | `ls -la $path` |
| Watcher doesn't fire | File watcher / config | `/vm watcher status` |
| Subagent hangs/never returns | Subagent context / model | check `~/.pi/agent/sessions/` |
| Embedding dimension mismatch | Config schema change | `/vm reindex --reembed` |
| Search returns nothing | Empty index or wrong collection | `vm_status` |

## Step 2: Decision tree per category

### "command not found" / "is not defined"

```
Is the extension listed in `pi list`?
├── NO → install it
│   ├── `pi install npm:pi-vault-mind`
│   └── `pi install npm:pi-context`
└── YES → is it enabled in this session?
    ├── Check settings.json packages array
    └── Try `pi -e npm:pi-vault-mind` to force-load
```

### "connection refused"

```
What service?
├── Ollama → `ollama list` 
│   ├── works → check `vaultMind.embedding.ollamaHost` in config (default http://127.0.0.1:11434)
│   └── fails → `ollama serve` or install Ollama
└── LanceDB → `ls $vaultMind.dataDir`
    ├── exists but unreadable → check permissions
    └── doesn't exist → run `/vm init` to scaffold
```

### "permission denied"

```
Path is to a file or directory?
├── file → `ls -la $file` — does the user own it?
│   └── chown or chmod as appropriate
└── directory → `ls -ld $dir` — does the user have +x (traverse)?
    └── `chmod +x $dir` or fix ownership
```

### Watcher doesn't fire on save

```
Is the watcher running?
├── `/vm watcher status` says STOPPED
│   └── `/vm watcher start`
└── RUNNING but not detecting
    ├── Is the vault path correct?
    │   └── check `vaultMind.vaults` in config
    ├── Is the file inside a watched dir?
    │   └── .obsidian/ and .git/ are auto-ignored
    ├── Did the file have a recognized marker?
    │   └── format: `@agent-Role[:id] instruction`
    └── Check debounce — 1s after save before processing
```

### Subagent hangs or never returns

```
Check the child session file
├── ls ~/.pi/agent/sessions/ | tail -5
├── Find the most recent forked session
├── Open the .jsonl — look for "needs_attention" or "interrupted"
└── If needs_attention:
    ├── The child is waiting for input
    ├── Resume: subagent({ action: "resume", id: "..." })
    └── Or interrupt: subagent({ action: "interrupt", id: "..." })
```

### Embedding dimension mismatch

```
Did you switch embedding provider?
├── transformers (384d) → ollama embeddinggemma (768d)
│   └── `/vm reindex --reembed` (drops and recreates tables)
└── ollama (768d) → transformers (384d)
    └── same fix: `/vm reindex --reembed`
```

### Search returns no results

```
Is the index populated?
├── vm_status shows 0 rows
│   └── Append a test fact first: `vm_append(...)`
│       └── Tables are created lazily on first write
└── vm_status shows N rows but search is empty
    ├── Wrong collection? `vm_status` shows per-collection counts
    ├── Wrong query? Try broader keywords
    └── Try vm_fts_search (Tantivy BM25) for exact keyword
```

## Step 3: Nuclear options

When nothing else works, in order of destructiveness:

1. **`/vm validate`** — health check, lists everything that's wrong
2. **`/vm reindex --reembed`** — rebuild indexes (slow but safe)
3. **`/vm setup` (reconfigure)** — overwrites config (keeps data)
4. **Delete `$vaultMind.dataDir`** — DESTROYS all indexed data. JSONL WAL is preserved.
5. **Reinstall the extension** — `pi remove npm:pi-vault-mind && pi install npm:pi-vault-mind`

Always check the JSONL WAL first — that's the source of truth and can be re-indexed from scratch.

## Common error messages decoded

| Error | What it means | Fix |
|---|---|---|
| `ENOSPC: no space left on device` | Disk full | Free space, then `/vm reindex --all` |
| `EMFILE: too many open files` | `fs.watch` hitting OS limit | `ulimit -n 1024` and restart |
| `EACCES: permission denied` | Filesystem permissions | `chown` or `chmod` |
| `ENOTDIR: not a directory` | Path points to a file | Fix the path in config |
| `Cannot find module '@lancedb/lancedb'` | npm deps not installed | `pnpm install` in extension dir |
| `EADDRINUSE` (Ollama) | Port 11434 already in use | Kill the other process or change `ollamaHost` |
| `index out of range` | LanceDB table corruption | `/vm reindex --all` |
| `LanceDB version mismatch` | Old data on disk | Delete `$vaultMind.dataDir` and reindex from JSONL |

## Where to find logs

| Component | Log location |
|---|---|
| pi-vault-mind | `console.log` from extension (visible in pi session) |
| Watcher | same |
| LanceDB | `~/.lancedb/` or `$vaultMind.dataDir/` |
| Subagent | `~/.pi/agent/sessions/<session-id>.jsonl` |
| Ollama | `journalctl -u ollama` or `~/.ollama/logs/` |
| Obsidian | Obsidian console: Ctrl+Shift+I |

## When all else fails

1. Read the error message slowly
2. Check `TROUBLESHOOTING.md` in the repo
3. Run `/vm validate` and read its output
4. File an issue: https://github.com/kylebrodeur/pi-vault-mind/issues
