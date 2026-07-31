# Obsidian Vault Structure

Recommended layout for a vault used with pi-vault-mind. Combines **PARA method** + **Johnny Decimal organization** + **knowledge store structure** for a workspace that works for both humans and agents.

## The Folder Tree

```
Vault/
├── 00 - System/              ← Templates, inbox, daily notes, meta-configuration
├── 10 - Projects/            ← Active projects (PARA)
├── 20 - Areas/               ← Ongoing domains (PARA)
├── 30 - Resources/           ← Reference material (PARA)
│   ├── Inbox/                ← 📥 Drop files here for passive agent ingestion
│   ├── Sources/              ← any2md-processed documents (immutable sources)
│   └── Articles/             ← External references
├── 40 - Archive/             ← Completed/archived items (PARA)
│
├── Agent/                    ← 🤖 Agent-Collaborative Workspace
│   ├── Inbox/                ← Human drops tasks/requests for agents (@agent-*)
│   ├── Library/                 ← Agent-curated structured knowledge
│   │   ├── Concepts/         ← Agent-written concept pages with typed edges
│   │   ├── Entities/         ← People/orgs/systems with `agent:derived-from` links
│   │   ├── Syntheses/        ← Cross-topic analysis pages
│   │   └── Summaries/        ← Source document summaries
│   ├── Journal/              ← Agent activity log (timestamped, append-only)
│   ├── Tasks/                ← Agent task boards (Kanban markdown or Bases)
│   └── Presentations/        ← NotebookLM-generated podcasts, slides, quizzes
│
├── index.md                  ← Master routing table (agent + human navigable)
└── CLAUDE.md                 ← Agent instructions + domain constraints
```

## Why this structure

### PARA for humans
- **Projects** (10-) have a deadline
- **Areas** (20-) are ongoing responsibilities
- **Resources** (30-) are topics of interest
- **Archive** (40-) is everything completed

### Agent/ for subagents
This is the shared workspace where agents read, write, and produce. Each subfolder has a specific role:
- `Inbox/` — human drops `@agent-XXX` markers here. Watcher detects them.
- `Library/Concepts/` — Miner writes concept pages here with frontmatter
- `Library/Entities/` — entity pages (people, systems) with `agent:derived-from` typed edges
- `Library/Syntheses/` — cross-topic analysis from the Broadcaster
- `Journal/` — append-only activity log, useful for `/vm journal` queries
- `Tasks/` — agent-maintained task boards (Kanban markdown or `.base` files)
- `Presentations/` — NotebookLM outputs (audio, video, slides)

### Johnny Decimal for navigation
- `00-09` — System/meta
- `10-19` — Active projects
- `20-29` — Ongoing areas
- `30-39` — Reference resources
- `40-49` — Archive

Each folder has an `index.md` for routing.

## Required frontmatter

All agent-written pages should have strict YAML frontmatter:

```yaml
---
title: "RLHF"
domain: "alignment"           # or "research", "decision", "experiment"
source: "arxiv.org/abs/..."   # or "user-prompt", "notebook"
status: "draft"               # or "needs-review", "approved"
created: 2026-06-06
tags: ["reinforcement-learning", "alignment", "ppo"]
agent:related-to: "[[Reward_Modeling]]"
agent:derived-from: "[[Constitutional_AI]]"
---
```

The `agent:related-to`, `agent:derived-from`, etc. are **typed edges** that Breadcrumbs parses.

## Sync strategy

### Obsidian Sync (primary)
For real-time sync across the user's devices. Handles 99% of human interaction.

### Git (long-term + agent work)
- **`obsidian-git` plugin** — auto-commits every X minutes
- **Git worktrees** for Heavy-Lifter — large refactors in isolated branches, then merged

## Recommended Obsidian settings

In `Settings → Files & Links`:
- **New link format**: Shortest possible (when possible)
- **Use [[Wikilinks]]**: ON
- **Always update internal links**: ON

In `Settings → Core Plugins`:
- ✅ Backlinks
- ✅ Outline
- ✅ Word count
- ✅ File recovery

Community plugins to install:
- `obsidian-git` — auto-commit
- `Breadcrumbs` — typed-edge graph
- `Graph Analysis` — co-citation discovery
- `Actions URI` — cross-app automation
- `Vault Mind plugin` — native setup/status/chat + local bridge trigger
