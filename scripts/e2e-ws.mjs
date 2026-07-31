#!/usr/bin/env node
/**
 * E2E smoke for the WebSocket /agent/stream endpoint and the REST
 * queue/vm routes it streams events for.
 *
 * Boots a real server on an ephemeral port, opens an authenticated ws
 * client, exercises retry/cancel/search over HTTP, asserts the expected
 * queue events arrive over the socket, then exits 0 on success or 1 on
 * failure.
 *
 * By default it uses the recycvape vault at ../recycvape/ReturnVape if it
 * exists, otherwise a fresh temp vault. Override with PVM_E2E_VAULT.
 *
 * Usage:
 *   pnpm build                       # produces dist/src/*.js
 *   pnpm e2e:ws                      # or: node scripts/e2e-ws.mjs
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { WebSocket } from "ws";

const { createServerState, startServer, stopServer } = await import("../dist/src/server.js");
const { createWatcherState } = await import("../dist/src/watcher.js");
const { createJob, markJobDone } = await import("../dist/src/agent-queue.js");
const { _resetAuthCache } = await import("../dist/src/auth.js");

const TOKEN = process.env.PVM_API_TOKEN || `e2e-ws-${Math.random().toString(36).slice(2)}`;
const API_HEADERS = {
	"Content-Type": "application/json",
	Authorization: `Bearer ${TOKEN}`,
};

let failures = 0;
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
	failures++;
	console.log(`  ✗ ${msg}`);
};
const step = (msg) => console.log(`\n${msg}`);

function tmpDir(prefix) {
	return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function defaultVaultPath() {
	if (process.env.PVM_E2E_VAULT) {
		return path.resolve(process.env.PVM_E2E_VAULT);
	}
	const recycvape = path.resolve(import.meta.dirname, "../../recycvape/ReturnVape");
	if (fs.existsSync(recycvape)) return recycvape;
	return tmpDir("pvm-e2e-vault-");
}

function ensureProjectConfig(vaultPath) {
	const cfgPath = path.join(vaultPath, ".vault-mind", "vault-mind.config.json");
	if (!fs.existsSync(cfgPath)) {
		fs.mkdirSync(path.dirname(cfgPath), { recursive: true });
		fs.writeFileSync(
			cfgPath,
			JSON.stringify(
				{
					version: 2,
					collections: {
						main: {
							path: "collections/main.jsonl",
							schema: ["id", "domain", "source", "fact", "tag", "artifact"],
							dedupField: "fact",
						},
					},
					injectors: [],
					vaultMind: {
						dataDir: ".lancedb",
						embedding: {
							provider: "modal",
							modal: {
								workspace: "kylebrodeur",
								model: "embeddinggemma",
							},
						},
						vaults: { default: { path: vaultPath } },
					},
				},
				null,
				2
			),
			"utf-8"
		);
	}
	const collDir = path.join(vaultPath, "collections");
	if (!fs.existsSync(collDir)) fs.mkdirSync(collDir, { recursive: true });
	const mainColl = path.join(collDir, "main.jsonl");
	if (!fs.existsSync(mainColl)) fs.writeFileSync(mainColl, "", "utf-8");
}

function createCollectingWs(url, headers) {
	const ws = new WebSocket(url, { headers });
	const events = [];
	ws.on("message", (data) => {
		try {
			events.push(JSON.parse(data.toString()));
		} catch {
			events.push(data.toString());
		}
	});
	return {
		ws,
		events,
		waitFor(count, timeoutMs = 15000) {
			return new Promise((resolve, reject) => {
				if (events.length >= count) return resolve(events.slice(0, count));
				const timer = setTimeout(() => {
					if (events.length >= count) {
						resolve(events.slice(0, count));
					} else {
						reject(
							new Error(
								`expected ${count} ws events, got ${events.length}: ${JSON.stringify(events)}`
							)
						);
					}
				}, timeoutMs);
				const check = () => {
					if (events.length >= count) {
						clearTimeout(timer);
						ws.off("message", check);
						resolve(events.slice(0, count));
					}
				};
				ws.on("message", check);
			});
		},
	};
}

function waitForOpen(ws, timeoutMs = 10000) {
	return new Promise((resolve, reject) => {
		if (ws.readyState === ws.OPEN) return resolve();
		const timer = setTimeout(() => reject(new Error("ws open timeout")), timeoutMs);
		ws.once("open", () => {
			clearTimeout(timer);
			resolve();
		});
		ws.once("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

function waitForClose(ws, timeoutMs = 5000) {
	return new Promise((resolve, reject) => {
		if (ws.readyState === ws.CLOSED) return resolve();
		const timer = setTimeout(() => reject(new Error("ws close timeout")), timeoutMs);
		ws.once("close", () => {
			clearTimeout(timer);
			resolve();
		});
		ws.once("error", (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

async function httpJson(port, method, path_, body) {
	const res = await fetch(`http://127.0.0.1:${port}${path_}`, {
		method,
		headers: API_HEADERS,
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json;
	try {
		json = JSON.parse(text);
	} catch {
		json = { raw: text };
	}
	return { status: res.status, body: json };
}

async function main() {
	console.log("WebSocket + REST E2E smoke");

	const savedHome = process.env.HOME;
	const savedToken = process.env.PVM_API_TOKEN;
	const savedCwd = process.cwd();
	const vaultPath = defaultVaultPath();
	const isTempVault = !process.env.PVM_E2E_VAULT && vaultPath.includes(os.tmpdir());

	process.chdir(vaultPath);
	process.env.HOME = vaultPath;
	process.env.PVM_API_TOKEN = TOKEN;
	_resetAuthCache();

	let serverState;
	let wsClient;
	try {
		ensureProjectConfig(vaultPath);

		step("1. boot server on ephemeral port");
		const watcherState = createWatcherState();
		serverState = createServerState(0);
		startServer({}, serverState, watcherState);
		await new Promise((resolve, reject) => {
			const srv = serverState.server;
			if (!srv) return reject(new Error("server not created"));
			if (srv.listening) return resolve();
			srv.once("listening", resolve);
			srv.once("error", reject);
		});
		const addr = serverState.server.address();
		const port = typeof addr === "object" && addr ? addr.port : serverState.port;
		pass(`server listening on http://127.0.0.1:${port} (vault: ${vaultPath})`);

		step("2. connect ws client to /agent/stream");
		wsClient = createCollectingWs(`ws://127.0.0.1:${port}/agent/stream`, {
			Authorization: `Bearer ${TOKEN}`,
		});
		await waitForOpen(wsClient.ws);
		pass("ws client connected");

		step("3. receive queue/snapshot on connect");
		const snapshot = await wsClient.waitFor(1, 5000);
		if (snapshot.length === 1 && snapshot[0].type === "queue/snapshot") {
			pass(`snapshot received with ${snapshot[0].jobs?.length ?? 0} jobs`);
		} else {
			fail(`unexpected snapshot: ${JSON.stringify(snapshot)}`);
		}

		step("4. create a job and observe job-created event");
		const createdPromise = wsClient.waitFor(2, 5000);
		createJob(vaultPath, {
			id: "e2e-job-1",
			vaultPath,
			filePath: path.join(vaultPath, "note.md"),
			role: "miner",
			agentName: "vault-mind-miner",
			instruction: "E2E smoke job",
			markerCount: 1,
		});
		const created = await createdPromise;
		const createdEvent = created.find((e) => e.type === "job-created");
		if (createdEvent?.job?.id === "e2e-job-1") {
			pass("job-created event received");
		} else {
			fail(`unexpected create event: ${JSON.stringify(created)}`);
		}

		step("5. REST POST /agent/jobs/:id/cancel and observe completion event");
		const cancelPromise = wsClient.waitFor(3, 5000);
		const cancelRes = await httpJson(port, "POST", "/agent/jobs/e2e-job-1/cancel");
		if (cancelRes.status === 200 && cancelRes.body?.status === "cancelled") {
			pass("cancel REST returned 200 with cancelled job");
		} else {
			fail(`cancel REST failed: ${cancelRes.status} ${JSON.stringify(cancelRes.body)}`);
		}
		const cancelled = await cancelPromise;
		const cancelEvent = cancelled.find(
			(e) => e.type === "job-completed" && e.job?.status === "cancelled"
		);
		if (cancelEvent) {
			pass("job-completed event received after cancel");
		} else {
			fail(`unexpected cancel event: ${JSON.stringify(cancelled)}`);
		}

		step("6. REST POST /agent/jobs/:id/retry and observe updated event");
		const retryPromise = wsClient.waitFor(4, 5000);
		const retryRes = await httpJson(port, "POST", "/agent/jobs/e2e-job-1/retry");
		if (retryRes.status === 200 && retryRes.body?.status === "running") {
			pass("retry REST returned 200 with running job");
		} else {
			fail(`retry REST failed: ${retryRes.status} ${JSON.stringify(retryRes.body)}`);
		}
		const retried = await retryPromise;
		const retryEvent = retried.find((e) => e.type === "job-updated" && e.job?.status === "running");
		if (retryEvent) {
			pass("job-updated event received after retry");
		} else {
			fail(`unexpected retry event: ${JSON.stringify(retried)}`);
		}

		step("7. complete the job and observe completed event");
		const donePromise = wsClient.waitFor(5, 5000);
		const doneJob = markJobDone(vaultPath, "e2e-job-1");
		if (doneJob?.status === "done") {
			pass("job marked done");
		} else {
			fail(`markJobDone did not return done job: ${JSON.stringify(doneJob)}`);
		}
		const done = await donePromise;
		const doneEvent = done.find((e) => e.type === "job-completed" && e.job?.status === "done");
		if (doneEvent) {
			pass("job-completed event received after markJobDone");
		} else {
			fail(`unexpected done event: ${JSON.stringify(done)}`);
		}

		step("8. REST POST /vm/append and /vm/search");
		const appendRes = await httpJson(port, "POST", "/vm/append", {
			collection: "main",
			entry: {
				id: "e2e-fact-1",
				domain: "e2e",
				source: "smoke",
				fact: "JWT tokens expire after one hour.",
				tag: "auth",
				artifact: "",
			},
		});
		if (appendRes.status === 200 && appendRes.body?.ok === true) {
			pass("append REST returned 200");
		} else {
			fail(`append REST failed: ${appendRes.status} ${JSON.stringify(appendRes.body)}`);
		}

		const searchRes = await httpJson(port, "POST", "/vm/search", {
			collection: "main",
			query: "JWT expire",
			limit: 5,
		});
		if (searchRes.status === 200 && Array.isArray(searchRes.body?.hits)) {
			pass(`search REST returned 200 with ${searchRes.body.hits.length} hit(s)`);
		} else {
			fail(`search REST failed: ${searchRes.status} ${JSON.stringify(searchRes.body)}`);
		}

		step("9. close ws and stop server");
		wsClient.ws.close();
		await waitForClose(wsClient.ws);
		pass("ws closed cleanly");
	} finally {
		if (wsClient && wsClient.ws.readyState !== wsClient.ws.CLOSED) {
			try {
				wsClient.ws.terminate();
			} catch {
				// ignore
			}
		}
		if (serverState) stopServer(serverState);
		if (savedHome === undefined) process.env.HOME = undefined;
		else process.env.HOME = savedHome;
		if (savedToken === undefined) process.env.PVM_API_TOKEN = undefined;
		else process.env.PVM_API_TOKEN = savedToken;
		process.chdir(savedCwd);
		_resetAuthCache();
		if (isTempVault) {
			try {
				fs.rmSync(vaultPath, { recursive: true, force: true });
			} catch {
				// ignore cleanup errors
			}
		}
	}

	console.log(`\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("\n❌ e2e-ws aborted:", err?.message ?? err);
	process.exit(1);
});
