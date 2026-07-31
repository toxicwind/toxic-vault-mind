---
name: obsidian-interactive-test
description: "Use during plugin testing — enables debug monitoring, takes screenshots (via CLI or Developer Toolbox), inspects DOM, tails console, checks functional state."
---

# Obsidian Interactive Test Monitor

Run these during plugin testing to see what the user sees in real time.

## Setup (run once at start of test session)

```bash
obsidian dev:debug on              # enable console capture
obsidian vault="ReturnVape" plugin:reload id=vault-mind  # ensure latest
```

**Developer Toolbox** (v0.9.0, installed in ReturnVape) provides richer dev tools:
- **Issue Capture**: annotated screenshots with plugin context — use instead of dev:screenshot when documenting bugs
- **Plugin Reloader**: auto-reload on build change — replaces manual plugin:reload
- **CSS inspector**: browse `--vm-*` variables
- **Icon browser**: find icon IDs

Trigger from Obsidian command palette: "Developer Toolbox: ..."

## Screenshots

```bash
# Quick — obsidian CLI
obsidian vault="ReturnVape" dev:screenshot path=/tmp/vm-test.png

# Rich — Developer Toolbox (use when annotating a bug)
# Trigger: Cmd+P → "Developer Toolbox: Capture screenshot"
```

## Monitoring loop (run while user tests)

```bash
# Errors
obsidian vault="ReturnVape" dev:errors

# DOM state — what's visible
obsidian vault="ReturnVape" dev:dom selector=".vault-mind-panel" text
obsidian vault="ReturnVape" dev:dom selector=".vault-mind-tab-content:not([style*='none'])" text

# Full functional state check
obsidian vault="ReturnVape" eval code="(()=>{const l=app.workspace.getLeavesOfType('vault-mind-panel');const v=l[0]?.view;const chat=v?.tabs?.find(t=>t.id==='chat');return JSON.stringify({tabs:v?.tabs?.length,activeTab:v?.activeTab,chatHasPi:!!chat?.tab?.connection?.process?.pid,msgCount:chat?.tab?.view?.messages?.length})})()"

# Pi process running?
pgrep -fl "pi" | grep -v "Applications\|System\|usr\|omp\|Claude"

# Check heights (layout issues)
obsidian vault="ReturnVape" eval code="(()=>{const msgs=document.querySelector('.pi-messages');return JSON.stringify({h:msgs?.offsetHeight,children:msgs?.children.length})})()"
```

## After user reports an issue

1. `obsidian vault="ReturnVape" dev:errors` — crashes
2. `obsidian vault="ReturnVape" dev:dom selector=".vault-mind-tab-content:not([style*='none'])" text` — what's showing
3. `obsidian vault="ReturnVape" dev:console` — recent logs  
4. **Use Developer Toolbox Issue Capture** for annotated screenshot with context

## Deploy fix and reload

```bash
cd packages/obsidian && node esbuild.config.mjs production
cp main.js ~/workspace/recycvape/ReturnVape/.obsidian/plugins/vault-mind/
obsidian vault="ReturnVape" plugin:reload id=vault-mind
# Or use Developer Toolbox auto-reload if watching build output
```

## Functional assertions (not just error-free)

After init, verify these are ALL true:
```bash
obsidian vault="ReturnVape" eval code="(()=>{
  const hasPi=!!require('child_process').execSync('pgrep -f \"pi.*rpc\"',{stdio:['pipe','pipe','pipe']}).toString().trim();
  const panel=app.workspace.getLeavesOfType('vault-mind-panel')[0]?.view;
  const chat=panel?.tabs?.find(t=>t.id==='chat')?.tab;
  return JSON.stringify({
    panel_has_tabs: panel?.tabs?.length>0,
    chat_mounted: chat?.mounted,
    pi_connected: chat?.connection?.isConnected(),
    pi_process_alive: !!(chat?.connection?.process?.pid),
    messages_area_height: document.querySelector('.pi-messages')?.offsetHeight,
    piConfigDir_correct: chat?.deps?.piConfigDir?.startsWith('/')
  })
})()"
```
