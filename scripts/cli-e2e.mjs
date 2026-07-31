#!/usr/bin/env node
/**
 * CLI E2E integration test — exercises all HTTP surfaces built in CR-1.x, PR-2.x, TC-3.x.
 *
 * Creates a temp vault, starts the server, tests every route, verifies file outputs.
 *
 * Usage:
 *   pnpm build
 *   node scripts/cli-e2e.mjs
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");

// Create temp vault
const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "pvm-cli-e2e-"));
const vaultMindDir = path.join(vaultDir, ".vault-mind");
fs.mkdirSync(vaultMindDir, { recursive: true });

// Write a minimal config with vault path so the server can discover it
const configPath = path.join(vaultMindDir, "vault-mind.config.json");
const initialConfig = {
	version: 2,
	collections: {
		main: {
			path: "collections/main.jsonl",
			schema: ["id", "domain", "source", "fact", "tag", "artifact"],
			dedupField: "fact",
		},
	},
	vaultMind: {
		dataDir: ".lancedb",
		embedding: {},
		ftsEnabled: true,
		graph: { enabled: true, canvasSync: true },
		vaults: { default: { path: vaultDir } },
	},
};
fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf-8");

// Set token via env var (server reads from process.cwd(), not vault dir)
const TEST_TOKEN = `e2e-cli-${Math.random().toString(36).slice(2, 10)}`;
process.env.PVM_API_TOKEN = TEST_TOKEN;

// Also write to vault's env file for file-output verification tests
const tokenEnvPath = path.join(vaultMindDir, "vault-mind.env");
fs.writeFileSync(tokenEnvPath, `PVM_API_TOKEN=${TEST_TOKEN}\n`, "utf-8");

// Change cwd to vault dir so server operates on the temp vault
process.chdir(vaultDir);

// Set pi agent dir so model-router scaffold writes to vault
const agentDir = path.join(vaultMindDir, ".pi", "agent");
fs.mkdirSync(agentDir, { recursive: true });
process.env.PI_CODING_AGENT_DIR = agentDir;

// Import server + watcher
const { createServerState, startServer, stopServer } = await import(`${REPO}/dist/src/server.js`);
const { createWatcherState } = await import(`${REPO}/dist/src/watcher.js`);

// Start server on ephemeral port
const EPHEMERAL_PORT = 0;
const serverState = createServerState(EPHEMERAL_PORT);
const watcherState = createWatcherState();
const mockPi = { sendUserMessage: () => {}, registerCommand: () => {}, registerTool: () => {} };
startServer(mockPi, serverState, watcherState);
// Wait for server to be ready
await new Promise((resolve) => setTimeout(resolve, 200));
const port = serverState.port;
console.log(`Server: http://127.0.0.1:${port}`);

// Helper
const API = {
	headers: { "Content-Type": "application/json", Authorization: `Bearer ${TEST_TOKEN}` },
	base: `http://127.0.0.1:${port}`,
};

async function http(method, path, body) {
	const res = await fetch(`${API.base}${path}`, {
		method,
		headers: API.headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	return { status: res.status, body: text ? JSON.parse(text) : undefined, raw: text };
}

let pass = 0;
let fail = 0;
function check(label, ok) {
	if (ok) {
		pass++;
		console.log(`  \x1b[32m✓\x1b[0m ${label}`);
	} else {
		fail++;
		console.log(`  \x1b[31m✗\x1b[0m ${label}`);
	}
}

// ── Test 1: POST /vm/setup ──
console.log("\n── Test 1: POST /vm/setup ──");
const setup = await http("POST", "/vm/setup", {
	vault: vaultDir,
	model: "embeddinggemma",
	useTransformers: false,
});
check("returns 200", setup.status === 200);
check("returns ok:true", setup.body?.ok === true);

// ── Test 2: GET /vault-mind/config ──
console.log("\n── Test 2: GET /vault-mind/config ──");
const cfg = await http("GET", "/vault-mind/config");
check("returns 200", cfg.status === 200);
check("has vaultMind", !!cfg.body?.config?.vaultMind);
check("has hasToken", typeof cfg.body?.hasToken === "boolean");
check("has version", !!cfg.body?.version);

// ── Test 3: GET /vault-mind/paths ──
console.log("\n── Test 3: GET /vault-mind/paths ──");
const paths = await http("GET", "/vault-mind/paths");
check("returns 200", paths.status === 200);
check("has config", !!paths.body?.config);
check("has vaultPath", !!paths.body?.vaultPath);

// ── Test 4: POST /vm/token ──
console.log("\n── Test 4: POST /vm/token ──");
const tokenRes = await http("POST", "/vm/token", { token: "test-token-abc123" });
check("returns 200", tokenRes.status === 200);
check("returns ok:true", tokenRes.body?.ok === true);
check("returns path", !!tokenRes.body?.path);
const envContent = fs.readFileSync(tokenEnvPath, "utf-8");
check("file contains token", envContent.includes("test-token-abc123"));

// ── Test 5: PATCH /vm/config ──
console.log("\n── Test 5: PATCH /vm/config ──");
const patchRes = await http("PATCH", "/vm/config", {
	vaultMind: { vaults: { default: { autoStart: true } } },
});
check("returns 200", patchRes.status === 200);
check("returns ok:true", patchRes.body?.ok === true);
const updatedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
check("autoStart is true", updatedConfig.vaultMind?.vaults?.default?.autoStart === true);

// ── Test 6: GET /vault-mind/tools ──
console.log("\n── Test 6: GET /vault-mind/tools ──");
const tools = await http("GET", "/vault-mind/tools");
check("returns 200", tools.status === 200);
check("has tools array", Array.isArray(tools.body?.tools));
check("has 20 entries", tools.body?.tools?.length === 20);
check("has identities", !!tools.body?.identities);
check("has roles", !!tools.body?.identities?.roles);

// ── Test 7: GET /vault-mind/identities ──
console.log("\n── Test 7: GET /vault-mind/identities ──");
const identities = await http("GET", "/vault-mind/identities");
check("returns 200", identities.status === 200);
check("has roles", !!identities.body?.roles);

// ── Test 8: PUT /vault-mind/identities/:role/allowedTools ──
console.log("\n── Test 8: PUT /vault-mind/identities/:role/allowedTools ──");
const putTools = await http("PUT", "/vault-mind/identities/main/allowedTools", {
	allowedTools: ["read", "write", "edit"],
});
check("returns 200", putTools.status === 200);
check("returns ok:true", putTools.body?.ok === true);
check("returns role:main", putTools.body?.role === "main");
check(
	"returns correct array",
	JSON.stringify(putTools.body?.allowedTools) === JSON.stringify(["read", "write", "edit"])
);

// ── Test 9: POST /vault-mind/reload-identities ──
console.log("\n── Test 9: POST /vault-mind/reload-identities ──");
const reload = await http("POST", "/vault-mind/reload-identities");
check("returns 200", reload.status === 200);
check("returns ok:true", reload.body?.ok === true);
check("returns roles array", Array.isArray(reload.body?.roles));

// ── Test 10: Auth rejection ──
console.log("\n── Test 10: Auth rejection ──");
const badAuth = await fetch(`${API.base}/vm/token`, {
	method: "POST",
	headers: { "Content-Type": "application/json", Authorization: "Bearer wrong-token" },
	body: JSON.stringify({ token: "x" }),
});
check("bad auth returns 401", badAuth.status === 401);

// ── Test 11: Method not allowed ──
console.log("\n── Test 11: Method not allowed ──");
const badMethod = await http("GET", "/vm/token");
check("GET /vm/token returns 405", badMethod.status === 405);

// ── Test 12: Verify scaffold output ──
console.log("\n── Test 12: Scaffold output ──");
const modelRouterPath = path.join(vaultMindDir, ".pi", "model-router.json");
check("model-router.json exists", fs.existsSync(modelRouterPath));
const collectionsDir = path.join(vaultDir, "collections");
check("collections/ dir exists", fs.existsSync(collectionsDir));
const mainJsonl = path.join(collectionsDir, "main.jsonl");
check("main.jsonl exists", fs.existsSync(mainJsonl));

// ── Cleanup ──
console.log("\n── Cleanup ──");
await stopServer(serverState);
fs.rmSync(vaultDir, { recursive: true, force: true });
console.log("Server stopped, vault cleaned up");

// ── Summary ──
console.log(`\n=== Results: ${pass} pass, ${fail} fail (${pass + fail} total) ===`);
process.exit(fail > 0 ? 1 : 0);
