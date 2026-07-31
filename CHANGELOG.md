# Changelog


## 0.16.12 / 0.6.16 — 2026-07-20

### Fixed

- **Minimal config before bridge start.** The setup wizard now writes a minimal `.vault-mind/vault-mind.config.json` with the vault path before starting the bridge, so `startServer` picks up the correct `vaultPath` immediately instead of falling back to `process.cwd()`.
- **Model-router vault isolation.** `model-router.json` is now always vault-scoped under `<vault>/.vault-mind/.pi/model-router.json`. The global `~/.pi/model-router.json` fallback is removed.
- **Stale `server.json` cleanup.** Dead PIDs and mismatched vault paths now delete the stale discovery file and spawn a fresh runtime instead of looping or throwing.
- **Vault path re-resolution after setup.** `POST /vm/setup` now updates the running server's `vaultPath` from the newly written config, preventing stale path references until restart.
- **Runtime files relocated.** `ensureVaultRuntime.ts` and `startFreshRuntime.ts` moved from `packages/obsidian/src/chat/` to `packages/obsidian/src/runtime/`.
- **Agent folder creation on setup save.** The four default Agent/ folders (Inbox, Library, Presentations, Journal) are now created during `POST /vm/setup` using the user's configured paths or defaults.
- **Expanded vault reset.** `reset-test-vault.sh` now also removes `Pi-Sessions/`, `AGENTS.md`, `.env.1pass`, `.omp/`, Agent/ subdirectories, and the entire `vault-mind` plugin directory.

### Verification

- Added stale-discovery cleanup tests (dead PID, mismatched vaultPath, healthy adoption).
- Expanded reset-test-vault assertions for all newly removed artifacts.

## 0.16.11 / 0.6.15 — 2026-07-20

### Fixed

- **Panel recovery after bridge startup.** A later panel reconciliation now rehydrates the same Queue, Activity, session, collection, pending-edit, and Git metadata that initial controller startup loads, so a bridge that becomes available after the panel mounted no longer leaves those surfaces permanently stale.
- **Deterministic ReturnVape reset.** `reset-test-vault.sh` verifies the PID and port registered in `.vault-mind/server.json` serve the target vault before terminating and waiting for that runtime. A stale registry cannot signal an unrelated PID. The reset no longer copies local plugin artifacts; BRAT is the only test-vault update path.

### Verification

- Added focused regressions for panel metadata recovery after an initial bridge outage, verified runtime termination, and stale-registry safety.


## 0.16.10 / 0.6.14 — 2026-07-20

### Added

- **First-run retry with notes.** After cancellation or a terminal personalization failure, the Personalize card retains an optional draft. A blank draft retries with `/vm personalize`; a nonblank trimmed draft is sent as explicit `@agent-personalize:` input and clears only after durable personalization completes.
- **Typed collection and injector management.** Vault Mind Settings now exposes authenticated collection and injector CRUD controls with validation for vault-relative paths, collection schemas, regex patterns, and referenced targets.

### Fixed

- **First-run chat lifecycle.** The onboarding surface remains stable through configuration and personalization transitions. The standard message feed is deferred until a durable personalized state and is instantiated at most once, preventing duplicate first-run cards from reactive remounts.
- **Long diff readability.** Diff cards collapse long proposal sides by default while retaining access to the full edit.
- **Settings persistence and layout.** The setup wizard forwards Auto-start to `POST /vm/setup`; Settings categories write the canonical nested configuration shape, and the plugin Settings pane uses the available Obsidian width.
- **Tool-card escaped text.** JSON-decoded multiline tool output renders actual line breaks and indentation instead of literal escape sequences.

### Verification

- Added focused coverage for retry-note dispatch, cancellation/failure retention, durable-success clearing, one-card first-run lifecycle transitions, long diff collapse, Settings persistence, and collection/injector contracts.
- The collection/injector CRUD and first-run retry flows remain pending published-artifact ReturnVape walkthroughs.


## 0.6.12 — 2026-07-19

### Fixed

- **Standardized ToolCard presentation.** Tool cards now use humanized tool labels, readable request summaries, structured result previews for text/object/array payloads, masked credential fields, file-path pills for file requests, and a chevron-backed Details disclosure for exact masked payloads.
- **Settings section persistence routing.** Editable Settings categories now map to the nested `PATCH /vm/config` shape instead of flat top-level patches, Embedding secret fields route through `PUT /vm/embedding/secrets`, and Automation now explains that tag-based auto-sync remains config-only until a dedicated editor ships.
- **Port-parity whitespace safety.** Canonical source hashing now treats interior Arrow template whitespace as byte-significant, keeps sandbox/plugin canonicalizers aligned, and guards ToolCard inline template markup against whitespace-text regressions.

### Tests

- Added ToolCard regressions for text/object/array rendering, malformed JSON fallback, masked credential handling, file-pill request rendering, and raw-details preservation.
- Added parity regression coverage for interior template whitespace and a shared-corpus agreement check between the sandbox and plugin canonicalizers.


## 0.16.8 / 0.6.11 — 2026-07-19

### Added

- **Persistent agent-model sequence editing.** The extension owns authenticated `GET/PUT /vm/model-router` routes, the typed client and configuration adapter expose the contract, and Settings now edits one primary model plus ordered fallbacks through the shared `ModelSequenceEditor` without writing Pi's model catalog.
- **Explicit personalization cancellation.** The first-run Personalize card now exposes a separate Cancel action while work is active. Cancellation invalidates the controller attempt, uses Pi's existing abort transport, restores the idle model/action controls immediately, and prevents a stale completion from revealing chat or writing the personalization marker.
- **Durable chat diff lifecycle.** Persisted vault-edit events hydrate actionable `DiffMessage` cards after reconnect, apply/reject actions retain their direction across retry, and the client authenticates its WebSocket connection. The remaining dedicated full-review/MergeView experience is tracked separately in the roadmap.

### Fixed

- **Embedding-only discovery catalogs.** Ollama and OpenAI-compatible probe results now retain explicit or known embedding-capable models, exclude known chat/generative families, preserve exact IDs/dimensions/order, and keep a configured current selection available without polluting newly discovered choices.
- **Personalization parser and write boundary.** Aborted assistant results are classified as cancellation rather than malformed JSON; normally completed malformed output still reports an error. Proposal parsing validates the complete two-file schema, preserves fenced Markdown and escaped content, rejects duplicate or alternate paths and empty create/update content, and permits writes only to the resolved agent-dir `system.md` and vault-root `AGENTS.md`.
- **Configuration persistence integrity.** Model-router configuration is written atomically; collection/injector configuration mutations preserve sibling vault configuration and explicit injector opt-outs rather than reintroducing scaffold defaults.
- **Portable chat state restoration.** Diff-card and composer lifecycle updates now propagate reactive completion/retry state through both the sandbox source and the Obsidian port without stale one-shot snapshots.

### Verified

- Completed the ReturnVape seven-step setup walkthrough, Local embedding discovery, populated folder defaults, the enabled context-automation choice, setup save, configured-panel handoff, first-run model selection, Cancel recovery, proposal review, and durable personalization completion in Obsidian 1.12.7 on macOS. The known Auto-start persistence defect remains tracked separately.
- Added focused regressions for model-router round trips, mixed-provider embedding filtering, configuration merge/injector invariants, persisted diff hydration and retry direction, composer completion, cancellation races, malformed-versus-aborted personalization output, strict proposal schema/path validation, and fenced Markdown preservation.

## 0.16.7 / 0.6.10 — 2026-07-18

### Fixed

- **Obsidian Markdown lifecycle.** Assistant Markdown renders through Obsidian's native renderer, renderer components unload on panel close or remount, stale asynchronous opens cannot remount a closed panel, and deferred message fills cannot hijack a replacement message placeholder.
- **Generated sandbox constants.** Root builds now format the sandbox extension-package catalog they regenerate, so the release build cannot invalidate the sandbox verification suite.
- **Repository-only documentation.** Removed the obsolete MkDocs configuration, GitHub Pages deployment workflow, publication badges, and generated-site instructions while retaining maintained Markdown documentation in the repository.

### Tests

- Added focused regressions for Markdown cleanup ownership, direct remount disposal, close-during-refresh cancellation, and deferred placeholder isolation.

## 0.6.9 — 2026-07-18

### Fixed

- **First-run personalization recovery.** The configured-vault onboarding card now retains its active personalization state until durable runtime status confirms completion, including when the prompt acknowledgement fails or a permission request is pending. The chat feed and composer remain correctly gated until then.
- **Portable model selection.** The shared panel contract now passes opaque model IDs end-to-end; the Obsidian adapter resolves each ID to Pi's provider/model RPC payload internally, preserving IDs that contain `/` or `:`.

### Tests

- Added focused regressions for acknowledgement failure, pending permission delivery, re-entry protection, and exact model-ID selection ordering.

## 0.16.6 / 0.6.8 — 2026-07-18

### Fixed

- **First-run personalization handoff.** Configured vaults now remain on a dedicated personalization card until `/vm personalize` durably completes, including the valid all-suggestions-rejected path. The chat feed and composer are revealed only after the persisted completion status is observed.
- **Live Pi model selection.** The first-run card now loads the active model and catalog from typed Pi RPC state, preserves provider and model ID for selection, and starts Pi only when a configured panel refresh needs that catalog.

### Tests

- Added regression coverage for first-run gating, model selection ordering, delayed personalization completion, and demand-driven Pi model loading.

## 0.16.5 / 0.6.7 — 2026-07-18

### Fixed

- **Vault-scoped runtime ownership.** The plugin serializes startup per vault, adopts only a healthy bridge for the same canonical vault, and uses the configured `vaultMind.files.serverState` discovery path. This prevents duplicate Pi runtime launches across plugin instances and reloads.
- **Post-setup chat handoff.** A successful setup refreshes the shared panel controller before revealing an existing Vault Mind leaf. The panel remains available with its retained status if that refresh transiently fails.
- **Setup REST identity.** `GET /vm/status` now returns the configured vault identity so the plugin can verify runtime ownership.

### Tests

- Added focused coverage for same-vault startup serialization, custom runtime discovery paths, setup-to-chat refresh ordering, and mount-on-refresh-failure behavior.

## 0.16.4 / 0.6.6 — 2026-07-17

### Fixed

- **Obsidian-contained popovers.** Shared folder pickers now convert viewport anchor coordinates into the workspace leaf's fixed containing block, so their menus stay aligned with their input fields in the real Obsidian shell.
- **Cloud-only default chat routing.** New vault model-router configurations use `ollama/gemma4:31b-cloud` for every auto profile tier and explicit cloud fallbacks only. ReturnVape's active vault-local runtime configuration was migrated to remove local Gemma chat routes; local embedding models remain unchanged.

### Tests

- Added focused regression coverage for contained popover placement and cloud-only model-router defaults/profiles.

## 0.16.3 / 0.6.5 — 2026-07-16

### Added

- **`GET /vault-mind/models` endpoint.** Auth-gated route returns pi's
  provider/model catalog (`{ providers: ProviderInfo[] }`, plus an
  `error` field when a `models.json` exists but fails to parse), merged
  from the agent-dir and project-level `models.json` (project overrides
  agent-dir for same-named providers). `src/models.ts`
  `readModelProviders()` mirrors the plugin's `pi-config-reader.ts`
  flattened shape (`$`-stripped `envVarName`, model `name` falls back to
  `id`, providers sorted by name). New `VaultMindClient.getModels()`
  (typed `VmModelsResponse`) is the client bridge so the plugin can
  replace synchronous `models.json` disk reads with a live call. Covered
  by `test/rest-models.test.ts` (auth, empty, parse, override, malformed).

- **Extension-owned setup and configuration surfaces.** Added masked
  provider-credential status and atomic extension-owned secret storage,
  Local/Remote live embedding probes, complete typed setup/configuration
  client methods, default-vault sibling preservation, and a deterministic
  configuration E2E smoke. Added the portable seven-step Arrow setup
  wizard and twelve-category section-save Settings UI, then ported it into
  the Obsidian plugin behind a thin `RestConfigurationAdapter`. The plugin
  now uses typed runtime model discovery instead of synchronous
  `models.json` reads or writes, routes model selection through Pi RPC,
  mounts Settings through one adapter boundary, renders retryable offline
  recovery rather than a blank pane, and keeps plugin/extension bridge
  credentials separate from embedding-provider credentials. Added
  port-parity canonicalization for type re-exports, CSS/import guards,
  intrinsic SVG icon bounds, and focused regression coverage across the
  extension, sandbox, and plugin.

### Fixed

- **Un-imported `modalUrl` in `src/server.ts`** — the
  `handleVaultMindConfig` function destructured `modalUrl` from
  `../modal-config.js` without ever importing it. Would have crashed
  with `TypeError: Cannot read properties of undefined (reading 'space')`
  if the modal config branch was hit. Caught by
  `/tmp/pvm-e2e-http-setup-test.mjs`. Import is now in place.

### Documentation

- **`vault-mind-config-index.md` §12 — Modal extraction question.** New
  section documenting the open architectural question: should
  `pi-vault-mind`'s Modal-specific code (HTTP client, sync engine,
  `ModalProvider`, `/vm remote *` slash commands, `embedding.sync`
  config block, Python `modal/` app) move into a separate package
  (`pi-vault-mind-remote-modal/`) so the extension is truly
  provider-agnostic? Three options documented (A: namespace in-tree /
  B: extract to a package / C: server+client out, CLI stays). Smaller
  win called out regardless of option: drop `/vm remote *` in favor of
  `--remoteUrl` / `--remoteApiKey` flags on `/vm setup`. Awaiting
  user decision; no work committed.
- **§7.1 scope column.** Every `/vm *` slash command is now tagged
  `🟢 agnostic` / `🟡 Modal-specific` / `🔵 token` so the reader can
  see exactly which commands depend on Modal.

## 0.16.2 — 2026-07-07

### Changed

- **`ModalEmbeddingConfig` flattened into `EmbeddingConfig`.** Modal
  is just an OpenAI-compatible endpoint, so the `embedding.modal: {
  baseUrl, workspace, apiToken, readToken, writeToken, model, dim,
  fallback, sync }` wrapper is gone. All fields are now top-level on
  `EmbeddingConfig` itself: `workspace`, `remoteApiKey`,
  `remoteReadApiKey`, `remoteWriteApiKey`, `model`, `dim`, `fallback`
  (now a simplified `{ enabled?: boolean }` — the `provider`
  discriminator was already removed in 0.16.1+), and `sync`. **`apiKey`
  is now explicitly the local-Ollama bearer** (defaults to `"ollama"`
  in `OpenAICompatibleProvider`); the remote-endpoint token is
  `remoteApiKey` so a single config can carry distinct local-vs-remote
  credentials. The Modal-only blocks that remain as their own
  inline objects are `sync` (pull-down watermark behavior) and
  `fallback` (offline degrade policy). The `MODAL_APP_NAME` URL
  helper stays in `src/modal-config.ts` (`modalUrl(workspace)`); the
  Obsidian plugin keeps a small local mirror because it can't import
  from the extension at runtime. `isModal()` is now simply
  `!!cfg.embedding.remoteUrl`. The Obsidian plugin's
  `provider: "ollama" | "modal" | "skip"` UI discriminator was renamed
  to `"local" | "remote" | "skip"` (display labels stay user-friendly).
  On save, the Modal wizard removes the old `embedding.modal` block
  so existing configs upgrade cleanly on next `/vm setup`. The index
  doc `vault-mind-config-index.md` §2.4 is updated; the per-setting
  plan `vault-mind-config-plugin-surface.md` is reconciled.

### Removed

- **`ModalEmbeddingConfig` and `ModalFallbackConfig` types removed
  from `src/types.ts`.** Fields are inlined on `EmbeddingConfig` (see
  above). `FallbackConfig` (`{ enabled?: boolean }`) is the new
  simplified fallback shape; `ModalSyncConfig` is unchanged.

### Tests

- 268 tests pass (no change in count — the migration was mechanical).
  Three test files migrated from `modal: { ... }` fixtures to the
  flat shape: `test/auth.test.ts`, `test/lance-modal.test.ts`,
  `test/modal-config.test.ts`. The `ModalFallbackConfig["provider"]`
  type-level regression test was removed (the type no longer exists).
  One collateral fixture in `test/sync.test.ts`. One collateral
  fixture in `test/vault-tools.test.ts` (the `writeConfig` helper
  needed `model: "testmodel"` added so `resolveModel` returns the
  right value for the test's `searchFts` assertion). The provider-cache
  leak in `src/lance.ts`'s `resetConnection()` was fixed (the cache
  was module-level and survived across tests).


## 0.16.1 — 2026-07-07

### Added

- **`src/embedding-providers.ts`** — new store-agnostic `EmbeddingProvider`
  interface (`embed` / `dim` / `init`) and the three concrete providers
  (`OpenAICompatibleProvider`, `TransformersProvider`, `ModalProvider`)
  plus a `createProvider(cfg)` factory. The vector-store layer
  (`src/lance.ts`) now consumes providers through a 35-line
  `LanceEmbeddingAdapter` that wraps them into LanceDB's
  `TextEmbeddingFunction`. **Adding a new vector store (Qdrant, Pinecone,
  pgvector, …) means writing a new adapter; adding a new embedding
  provider means implementing the interface.** No downstream code (lance,
  coalescer, plugin) needs to change for either.
- **`/vm remote config fallback`** accepts `"ollama"` as a friendlier
  alias for `"openai-compatible"` (rewritten to the enum value before
  write). Help text and error messages updated.

### Removed

- **`ModalFallbackConfig.provider` enum reduced to `"openai-compatible"`.**
  The legacy `"transformers"` value was dead code (no runtime path
  selected it). The offline transformers path lives separately under
  `EmbeddingConfig.useTransformers`. `/vm remote config fallback` parser
  no longer accepts `"transformers"`. Type-level regression test
  prevents the dead value from being added back.

### Fixed

- **`LanceEmbeddingFunction` now defaults `apiKey` to `"ollama"`** for
  local endpoints, matching `AgentModelProvider`'s behavior and the
  JSDoc contract. The previous `string | undefined` field would have
  sent `Authorization: Bearer undefined` for any vault without an
  explicit `apiKey`; Ollama happened to ignore the malformed header,
  but stricter `/v1/embeddings`-compatible servers would have rejected
  it. Pass `apiKey: null` to opt out (some local servers reject
  `Bearer ollama` as invalid auth).
- **`IdentityConfig.role` made optional.** It was required at the type
  level but `mergeIdentityProfiles` always pulls `role` (and `id`) from
  the base — config cannot rename an agent. Required type was dead.
- **Index doc §2.6 `vaultMind.identities` reframed as "wired but
  unenforced"** — the block is read at engine start
  (`engine.ts:124-137` calls `mergeIdentityProfiles` and
  `bridge.ts:100` registers the merged identity), but the registered
  identity is never read back (`getAgentIdentity` in `bridge.ts:117`
  has no callers). The block stays typed; future runtime enforcement
  reuses it. New regression test in `test/bridge-identity.test.ts`
  pins the merge contract (layer values override, empty array is
  explicit deny, role/id always from base, undefined layer is a no-op).
- **Config example drift closed.** `pi-vault-mind.config.example.json`
  now shows the scaffolded `draft-context` injector instead of an
  empty array — matches the live `src/scaffold.ts` output so a user
  hand-rolling a config from the example doesn't silently miss a
  built-in.

## 0.16.0 — 2026-07-06

### Added

- **New `src/scaffold.ts`** — the single, UI-agnostic implementation of vault
  config scaffolding (default collections/injectors, `.gitignore`), shared
  by the CLI `/vm setup` command, the HTTP `POST /vm/setup` route, and any
  future consumer. Robust to caller order: seeds default collections/
  injectors whenever they're empty, not only when the config file is brand
  new, so no future caller can silently end up with `"collections": {}`
  again by writing embedding/vault fields before calling it.

### Removed

- **Legacy config/token migration dropped entirely.** `migrateLegacyState()`
  and the `CONFIG_FILES` legacy-filename list are gone; pi-vault-mind no
  longer rescues config/token from a vault-root `pi-vault-mind.config.json`,
  `.pi/vault-mind.config.json`, or the global `~/.pi/agent/`. `.vault-mind/`
  is now the only place pi-vault-mind ever reads its own config/token from —
  no backward-compat fallback path.
- **`/vm init` removed as a standalone command.** It only ever duplicated
  part of `/vm setup`'s work with a deprecation notice; fully consolidated
  onto `/vm setup`, which now also accepts `--collection <name>` (previously
  only available via `/vm init --collection`). Every "Run /vm init first"
  message across `commands.ts`, `settings-ui.ts`, `tools.ts`,
  `vm-handlers.ts`, and `tools/marksman.ts` now says `/vm setup`.
- **`POST /vm/init` removed from the HTTP API.** It duplicated a third copy
  of the collections/injectors scaffold template (alongside the CLI's and
  the Obsidian plugin's own copies). `POST /vm/setup` now calls the same
  shared `scaffoldVaultConfig()` after writing embedding/vault fields, so it
  does everything `/vm/init` did plus its own job, and its response now
  includes `created`/`updated`/`skipped`/`collectionName`. The Obsidian
  plugin's `VaultMindClient.init()` (only caller: the chat composer's
  `/reindex` command) is removed too — it now calls `client.setup({})`
  directly, since the reindex flow never used `init()`'s return value.

### Fixed

- **`/vm setup` never actually scaffolded default collections.** `handleInit`
  (the scaffold logic) only populates the default `main`/`pending`/
  `context_events` collections and the `draft-context` injector when the
  config file doesn't exist yet — but `setupWizard` always wrote the config
  file *first*, so `handleInit` permanently saw an existing file and took its
  merge-safe (no-op-for-collections) branch instead. Every `/vm setup` run,
  CLI or interactive, ended with `"collections": {}`. Reordered so
  `handleInit` runs before `setupWizard`; verified end-to-end (fresh vault →
  `/vm setup` → all three default collections + injector scaffolded with the
  vault-derived file name, confirmed via direct JSONL read-back).
- **`loadConfig` returned duplicate injector entries, causing them to fire
  twice.** `mergeConfigLayer` concatenated `DEFAULT_CONFIG.injectors` with
  the vault's own config-file injectors with zero deduplication. Since every
  vault's config now always has its own `draft-context` injector (scaffolded
  by `/vm setup`), `loadConfig()` returned it twice — and `events.ts`
  processes every injector's regex match independently, so a matching note
  would trigger the injector's capture/artifact-sync logic twice per prompt.
  Fixed by deduplicating by `name` in the merge (layer's entry wins on a
  collision), mirroring the existing dedupe pattern in `auditConfig`.
  Verified via `loadConfig` on a freshly-scaffolded vault: exactly one
  `draft-context` injector, not two.

## 0.15.0 / 0.6.4 — 2026-07-06

### Added

- **`/vm setup` now scaffolds `.vault-mind/.pi/model-router.json`** with tuned
  primary/fallback model defaults, extracted verbatim from the Obsidian
  plugin's `scaffoldModelRouterConfig`/`defaultModelRouterChoices` into a new
  `src/model-router.ts` — previously only the plugin's init flow produced
  this file, so a CLI-only setup got no model-router config at all.
- **`scripts/setup-vault-pi.sh` now installs `pi-model-discovery` and
  `pi-model-router`** alongside `pi-vault-mind`/`pi-context`, matching the
  plugin's install list (previously missing both, so a CLI-only setup never
  got model discovery or routing installed).

### Changed

- **Vault isolation** — all pi-vault-mind config, token, and written artifacts now live under `<vault>/.vault-mind/`. The global `~/.pi/agent/vault-mind.config.json` layer is dropped; config is single-layer, vault-local. Legacy config/token is auto-migrated on first session_start (idempotent).
- **Config consolidation** — `loadConfig` reads only `<vault>/.vault-mind/vault-mind.config.json`; `findConfig` returns a single project path. `getGlobalConfigPath`/`getGlobalConfigDir` removed.
- **Token env** — `PVM_API_TOKEN` dotenv file moved from `~/.pi/agent/vault-mind.env` to `<vault>/.vault-mind/vault-mind.env`. `auth.ts`, `modal-config.ts`, `commands.ts`, and `settings-ui.ts` all resolve via `getTokenEnvPath(cwd)`.
- **Framework agent dir** — launch scripts now use `<vault>/.vault-mind/.pi/agent` (relocated from `<vault>/.pi/agent`). `resolveAgentDir(cwd)` honors `PI_CODING_AGENT_DIR` via the SDK.
- **ACM gate** — auto-ACM now fires only when `isVaultMindReady` is true (config exists + embedding configured), not on any vault with a global config.
- **Configurable file paths** — `graph.canvasPath`, `files.queue`, `files.serverState`, `files.manualDispatch` in config; `resolveVaultFile` resolves them with defaults under `.vault-mind/`.
- **Per-vault Modal collection prefix** — `vaults.default.collectionPrefix` (auto-derived from vault slug) isolates server-side Modal tables across vaults sharing a deployment. Local LanceDB tables stay unprefixed.
- **`/vm setup` consolidation** — now runs `migrateLegacyState` → `setupWizard` → merge-safe scaffold → optional `runPersonalize`. `/vm init` is deprecated (still works, shows notice).
- **`/vm doctor`** — new command reporting resolved paths, readiness, token source, model-router status, and PASS/WARN for vault isolation.
- **`GET /vault-mind/paths`** — new auth-gated HTTP endpoint returning absolute + vault-relative paths with `exists` flags.
- **gitignore** — `.vault-mind/*` + `!.vault-mind/vault-mind.config.json` keeps the hand-tuned config tracked while ignoring local state.

### Fixed

- **Config write-target bugs** — `vm_configure`, `discover_schema`, and the
  `POST /vm/init` HTTP handler's scaffold-if-missing path all still wrote to
  the vault-root `pi-vault-mind.config.json` (a path `loadConfig` no longer
  reads) instead of `.vault-mind/vault-mind.config.json`. Fixed to use
  `getConfigPath(cwd)` uniformly.
- **Stale user/dev-facing config paths** — the "no vaults configured" notify
  string (`commands.ts`), the `discover_schema` tool's prompt guidelines, and
  a `server.ts` doc-comment all still told the reader to edit the retired
  `pi-vault-mind.config.json` instead of `.vault-mind/vault-mind.config.json`.
- **`/vm setup` CLI-mode arg parsing** — when `--vault` was the first flag
  (exactly the form documented in `CLI_ONLY_WALKTHROUGH.md`), its leading
  `--` was never stripped by the tokenizer, so `cliArgs.vault` was silently
  never set and `vaults.default.path` was left empty. Fixed the split to
  normalize the leading `--` before tokenizing.

### Removed

- Dead `events.ts` hidden `/acm` sendMessage path (never enabled compaction).
- `handleVaultMindConfig` HTTP response no longer splits `.global`/`.project` (single `config` key).

### Plugin (`packages/obsidian/`)

- **Isolation parity with the extension** — `resolvePluginAgentDir(vaultPath)`
  now resolves `<vault>/.vault-mind/.pi/agent`, threaded through `main.ts`
  (init flow, config paths, hasExtensions checks, token/1Password flow),
  `model-router-config.ts` (models.json + model-router.json paths),
  `pi-config-reader.ts`, `chat-tab.ts`, `status-tab.ts`, and `panel.ts`.
- **`.vault-mind/vault-mind.config.json`** — `config.ts`'s `readExtensionConfig`
  now reads the single vault-scoped config (previously read the removed
  global `~/.pi/agent/vault-mind.config.json` + vault-root
  `pi-vault-mind.config.json`).
- **`.env.1pass` relocated to `.vault-mind/.env.1pass`**, with `--op-env`
  wired into every pi launch site (`PiConnection` in `chat-tab.ts`, the TUI
  launcher in `status-tab.ts`, and `scripts/vault-pi.sh`/`setup-vault-pi.sh`) —
  gated on the file existing AND `pi-1password` being installed, since
  `--op-env` is a flag `pi-1password` registers; passing it unconditionally
  would make `pi` reject the whole invocation with "Unknown option" when the
  extension isn't installed.

## 0.5.1 — 2026-06-28

### Fixed

- Bundled `json5` into the Obsidian plugin (`main.js`) so the plugin loads in Obsidian without requiring the dependency externally.

## 0.13.0 / 0.5.0 — 2026-06-28

### Added

- **Arrow.js chat UI refactor** — reactive composer (`chat/arrow/`), model chip in the input bar, mentionable badges with preview popup, per-assistant-message action row (copy/info/rewind), keyboard-navigable session popover, and Arrow-based permission modals.
- **`@agent` dispatch command** — Obsidian palette command that picks a vault-mind role, prompts for an instruction, and calls `POST /vault-mind/dispatch`; also adds `VaultMindClient.scan()` for immediate tag-based scanning.
- **Marksman LSP tool wrappers** — `vm_backlinks`, `vm_broken_links`, `vm_related` with graceful degradation when `marksman` is unavailable.
- **Setup model-router picker** — vault init now lets users choose the primary chat model and fallback model sequence, writing choices directly into `.pi/model-router.json`.
- **`op://` 1Password resolution** — Modal setup resolves `op://` references via the 1Password CLI and stores the actual token in the Obsidian keychain; test-connection now sends the bearer token and reports detailed errors.

### Changed

- `docs/ROADMAP.md` is now the single source of truth for project direction; `docs/NEXT_STEPS.md` is deprecated.
- `packages/obsidian/package.json` version now tracks the plugin manifest version.

### Fixed

- PVM_API_TOKEN injection into the `pi` subprocess via `resolveToken()` in `ChatTab.mount()`.
- Modal test connection failing silently because it did not send an `Authorization` header.

## 0.8.0 - 2026-06-24

### Added

- `discover_schema` tool and `/vm discover-schema` command — infer schema from a `.jsonl` file and register it as a collection.
- `tombstone_entry` tool and `/vm tombstone` command — redact a JSONL entry in place while preserving the append-only log format.
- `/vm query` command — hybrid semantic + FTS search over a collection from the slash command tree.
- `/vm collection list` command — list configured collections without opening the TUI selector.
- `ask_intake` interactive questionnaire tool with optional persistence to the ledger, vault, or both.
- Advanced deduping options (`dedupMode`, `dedupThreshold`) and background auto-indexing hooks for collection directories.
- Always-on capture **Tier A** recipe in `docs/getting-started/CAPTURE_SETUP.md` (iOS Shortcut + Actions for Obsidian, voice memo → Shortcut, desktop Templater hotkey).
- Vault-specific pi config + TUI launcher in the Obsidian plugin: reads `<vault>/.pi/agent/system.md` and launches pi from setup/status views.
- Published `pi-vault-mind@0.8.0` and `obsidian-pi-vault-mind@0.1.0` to npm.

### Fixed

- HOME capture path bug: `expandHome()` now falls back to `process.env.USERPROFILE` on Windows and handles bare `~` correctly.
- Broken internal markdown links after the 0.7.6 docs reorganization.
- Removed stale `site/` MkDocs build output from git tracking.

## 0.7.1 - 2026-06-14

### Fixed
- Renamed skill directories to `vault-mind-{role}` for consistency.
- Updated subagent dispatch names to match the new skill roles.
- Fixed `vault-mind-setup` skill description formatting.

### Changed
- Documentation cleanup across README, skills, and setup FAQ.
- CI configuration simplified for single-package repo.

## 0.7.0 - 2026-06-10

### Added
- Initial release of `pi-vault-mind`.
