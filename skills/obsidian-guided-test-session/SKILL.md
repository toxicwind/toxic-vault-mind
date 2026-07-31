---
name: obsidian-guided-test-session
description: "Run structured manual test sessions in the ReturnVape Obsidian vault: attach debugger, guide user through steps, poll console/errors, collect Developer Toolbox screenshots, and produce a token-efficient session report."
---

# obsidian-guided-test-session

Use this when manually testing the Vault Mind Obsidian plugin in the ReturnVape test vault. The assistant guides the session; the user drives the interaction in Obsidian and captures annotated screenshots with Developer Toolbox.

## Preconditions

- Obsidian is running with the ReturnVape vault open.
- Developer Toolbox plugin is installed and enabled.
- Vault Mind plugin is installed (BRAT-managed) and enabled.
- `obsidian` CLI is available in this session.

## Session artifacts

- Working scratchpad: `local://test-session-YYYY-MM-DD.md` (or `local://test-session-YYYY-MM-DD-HHMM.md` if multiple sessions per day).
- Archived report: `docs/test-sessions/YYYY-MM-DD-HHMM.md` after the session.

Template sections in the scratchpad:

```markdown
# Test Session — YYYY-MM-DD HH:MM

## Scope
- Plugin version tested:
- pi-vault-mind version tested:
- Areas under test:

## Steps / Checklist
- [ ] Step 1: ...

## Findings
| # | Step | Severity | Summary | Screenshot | Console/errors | Follow-up |
|---|------|----------|---------|------------|----------------|-----------|
| 1 |      |          |         |            |                |           |

## Console dump (only if relevant)
```

## Start a session

1. Create the scratchpad from the template above.
2. Record plugin versions:
   ```bash
   obsidian plugin id=vault-mind vault=ReturnVape
   ```
3. Attach the debugger and clear buffers:
   ```bash
   obsidian dev:debug on --vault ReturnVape
   obsidian dev:errors --vault ReturnVape clear
   obsidian dev:console --vault ReturnVape clear
   ```
4. Define the test plan checklist in the scratchpad.

## During the session

For each step:

1. Tell the user what to do in Obsidian (one action at a time, e.g. "Open the Vault Mind panel from the left sidebar", "Click the Setup tab").
2. Wait for the user to report completion or paste a screenshot path/annotation.
3. Poll errors and console:
   ```bash
   obsidian dev:errors --vault ReturnVape
   obsidian dev:console --vault ReturnVape --lines 50
   ```
4. If the user shares a screenshot, record its path. If they used Developer Toolbox annotations, note the annotation text.
5. If an issue is found, record it immediately in the findings table with:
   - Repro step
   - Expected vs actual behavior
   - Severity: `blocker`, `major`, `minor`, `polish`
   - Screenshot path (if any)
   - Relevant console/error snippet
   - Follow-up action (file bug, investigate, expected, etc.)
6. If the step succeeds, mark the checklist item done.

## Asking for screenshots

When a visual state matters, ask the user:

> Please capture a screenshot with Developer Toolbox and paste the saved file path here. Annotate anything that looks wrong.

Do not ask for screenshots on every step — only when visual state is ambiguous or an issue appears.

## Ending a session

1. Detach debugger:
   ```bash
   obsidian dev:debug off --vault ReturnVape
   ```
2. Summarize findings: count by severity, list blockers/majors first.
3. Archive the scratchpad to `docs/test-sessions/YYYY-MM-DD-HHMM.md`.
4. If there are actionable bugs, file them or add them to ROADMAP/Open Questions.

## Token efficiency rules

- Never paste image bytes into the conversation; only record paths/URIs.
- Pull full console/error output only when a step fails or an issue is found.
- Keep the running scratchpad as the single source of truth; append to it instead of repeating findings in chat.
- Use tables and short bullets for findings.
- Link follow-ups to existing ROADMAP/P2 items when possible.

## Common pitfalls to watch for

- Plugin fails to load: check `obsidian dev:errors` for `MODULE_NOT_FOUND` — usually an npm dependency not bundled into `main.js`.
- `PVM_API_TOKEN` missing: check Obsidian Settings → Vault Mind token status and the `obsidian dev:console` output.
- Chat composer blank or unresponsive: check console for Arrow/runtime errors; ask for a screenshot.
- Setup wizard looping: verify `.pi/` state and whether the vault has already been initialized.
