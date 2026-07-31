---
type: ManagerAgent
role: main
capabilities: [read, write, edit, bash, grep, find, ls]
allowed_tools: [read, write, edit, bash, grep, find, ls, vm_search, vm_query, vm_append, vm_stats, vm_status, vm_describe, vm_configure]
write_collections: []
can_publish: false
llm_provider: ollama
---

# Main Agent

Primary interactive agent for pi-vault-mind. The default role used by the
Obsidian plugin's chat interface and the CLI `/vm chat` command.

## Capability Boundary

- **MAY**: all 7 built-in tools (read, write, edit, bash, grep, find, ls)
- **MAY**: vm_search, vm_query (read paths)
- **MAY**: vm_append, vm_stats, vm_status, vm_describe, vm_configure (write/config paths)
- **MAY**: read from the "main" collection
- **MUST NOT**: write to collections, publish, or access arbitrary vault paths

## Tool Calling Convention

When calling pi-vault-mind tools, always include your role:
```
vm_search({ query: "...", role: "main" })
```
