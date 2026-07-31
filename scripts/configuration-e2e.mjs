#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { isDeepStrictEqual } from "node:util";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const MASK = "••••••••";
const READY_PREFIX = "CONFIGURATION_E2E_READY:";
const SECRET_KEYS = ["localApiKey", "remoteApiKey", "remoteReadApiKey", "remoteWriteApiKey"];
const LEGACY_CONFIG_KEY = {
	localApiKey: "apiKey",
	remoteApiKey: "remoteApiKey",
	remoteReadApiKey: "remoteReadApiKey",
	remoteWriteApiKey: "remoteWriteApiKey",
};
const COMPILED_PAIRS = [
	["src/auth.ts", "dist/src/auth.js"],
	["src/config-keys.ts", "dist/src/config-keys.js"],
	["src/embedding-probe.ts", "dist/src/embedding-probe.js"],
	["src/embedding-secrets.ts", "dist/src/embedding-secrets.js"],
	["src/modal-config.ts", "dist/src/modal-config.js"],
	["src/scaffold.ts", "dist/src/scaffold.js"],
	["src/server.ts", "dist/src/server.js"],
	["src/utils.ts", "dist/src/utils.js"],
	["src/watcher.ts", "dist/src/watcher.js"],
];

class CompiledOutputBlocker extends Error {}

function checkCompiledOutput() {
	const missing = [];
	const stale = [];
	for (const [sourceRelative, compiledRelative] of COMPILED_PAIRS) {
		const sourcePath = path.join(REPO_ROOT, sourceRelative);
		const compiledPath = path.join(REPO_ROOT, compiledRelative);
		if (!fs.existsSync(compiledPath)) {
			missing.push(compiledRelative);
			continue;
		}
		if (fs.statSync(sourcePath).mtimeMs > fs.statSync(compiledPath).mtimeMs) {
			stale.push(compiledRelative);
		}
	}
	if (missing.length > 0 || stale.length > 0) {
		const reasons = [];
		if (missing.length > 0) reasons.push(`missing: ${missing.join(", ")}`);
		if (stale.length > 0) reasons.push(`stale: ${stale.join(", ")}`);
		throw new CompiledOutputBlocker(
			`compiled extension output is not current (${reasons.join("; ")}); run npm run build`
		);
	}
}

function requireCondition(condition, message) {
	if (!condition) throw new Error(message);
}

function requireEqual(actual, expected, message) {
	requireCondition(Object.is(actual, expected), message);
}

function requireJsonEqual(actual, expected, message) {
	requireCondition(isDeepStrictEqual(actual, expected), message);
}

function withTimeout(promise, timeoutMs, message) {
	let timer;
	const timeout = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), timeoutMs);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function secretValue(label) {
	return `${label}_${randomUUID().replaceAll("-", "")}`;
}

function secretFragments(secrets) {
	return [
		...new Set(secrets.flatMap((secret) => [secret, secret.slice(0, 24), secret.slice(-24)])),
	];
}

function containsSecret(text, fragments) {
	return fragments.some((fragment) => fragment.length > 0 && text.includes(fragment));
}

function requireSecretFree(text, fragments, surface) {
	if (containsSecret(text, fragments)) {
		throw new Error(`${surface} exposed secret material`);
	}
}

function redactText(value, fragments) {
	let text = String(value);
	for (const fragment of [...fragments].sort((a, b) => b.length - a.length)) {
		text = text.replaceAll(fragment, "[REDACTED]");
	}
	return text;
}

function statusByKind(body, kind) {
	return body?.embeddingSecrets?.secrets?.find((entry) => entry?.kind === kind);
}

function mutationStatusByKind(body, kind) {
	return body?.secrets?.find((entry) => entry?.kind === kind);
}

function expectedStatus(kind, configured, source) {
	return { kind, configured, masked: configured ? MASK : null, source };
}

async function listen(server) {
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	requireCondition(address && typeof address === "object", "fixture did not bind a TCP port");
	return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
	if (!server?.listening) return;
	const closed = once(server, "close");
	server.close();
	server.closeAllConnections?.();
	await withTimeout(closed, 5_000, "fixture server teardown timed out");
}

async function createOpenAiFixture(name, models) {
	const calls = [];
	const firstDiscoveryPath = name === "local" ? "/api/tags" : "/models";
	const server = http.createServer((request, response) => {
		calls.push({
			method: request.method,
			path: request.url,
			authorization: request.headers.authorization,
		});
		response.setHeader("Content-Type", "application/json");
		if (request.method === "GET" && request.url === firstDiscoveryPath) {
			response.writeHead(404);
			response.end(JSON.stringify({ error: "OpenAI-compatible discovery only" }));
			return;
		}
		if (request.method === "GET" && request.url === "/v1/models") {
			response.writeHead(200);
			response.end(JSON.stringify({ object: "list", data: models.map((id) => ({ id })) }));
			return;
		}
		response.writeHead(404);
		response.end(JSON.stringify({ error: "not found" }));
	});
	return { server, calls, baseUrl: await listen(server) };
}

function childProgram() {
	const serverUrl = pathToFileURL(path.join(REPO_ROOT, "dist/src/server.js")).href;
	const watcherUrl = pathToFileURL(path.join(REPO_ROOT, "dist/src/watcher.js")).href;
	return `
import { once } from "node:events";
const { createServerState, startServer, stopServer } = await import(${JSON.stringify(serverUrl)});
const { createWatcherState } = await import(${JSON.stringify(watcherUrl)});
const serverState = createServerState(0);
const watcherState = createWatcherState();
const pi = {
  sendUserMessage() {},
  events: { emit() {} },
  getAllTools() { return []; },
  registerCommand() {},
  registerTool() {},
};
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  stopServer(serverState);
  setImmediate(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
startServer(pi, serverState, watcherState);
if (!serverState.server) throw new Error("compiled extension server was not created");
if (!serverState.server.listening) await once(serverState.server, "listening");
const address = serverState.server.address();
if (!address || typeof address !== "object") throw new Error("compiled extension server has no address");
process.stdout.write(${JSON.stringify(READY_PREFIX)} + address.port + "\\n");
`;
}

async function startExtension(vaultDir, fragments) {
	const child = spawn(process.execPath, ["--input-type=module", "--eval", childProgram()], {
		cwd: vaultDir,
		env: {
			HOME: vaultDir,
			LANG: process.env.LANG ?? "C",
			PATH: process.env.PATH ?? "",
			PI_CODING_AGENT_DIR: path.join(vaultDir, ".pi", "agent"),
			TMPDIR: os.tmpdir(),
			USERPROFILE: vaultDir,
		},
		stdio: ["ignore", "pipe", "pipe"],
	});

	const capture = { child, stdout: "", stderr: "" };
	let readyBuffer = "";
	const ready = new Promise((resolve, reject) => {
		child.stdout.on("data", (chunk) => {
			const text = chunk.toString();
			capture.stdout += text;
			readyBuffer += text;
			if (containsSecret(text, fragments)) {
				reject(new Error("compiled extension stdout exposed secret material"));
				return;
			}
			for (const line of readyBuffer.split(/\r?\n/)) {
				if (!line.startsWith(READY_PREFIX)) continue;
				const port = Number(line.slice(READY_PREFIX.length));
				if (!Number.isInteger(port) || port <= 0) {
					reject(new Error("compiled extension reported an invalid port"));
					return;
				}
				resolve(port);
				return;
			}
		});
		child.stderr.on("data", (chunk) => {
			const text = chunk.toString();
			capture.stderr += text;
			if (containsSecret(text, fragments)) {
				reject(new Error("compiled extension stderr exposed secret material"));
			}
		});
		child.once("error", () => reject(new Error("compiled extension process failed to start")));
		child.once("close", (code) => {
			reject(new Error(`compiled extension exited before readiness (status ${code ?? "signal"})`));
		});
	});

	try {
		capture.port = await withTimeout(ready, 15_000, "compiled extension readiness timed out");
		return capture;
	} catch (error) {
		await stopExtension(capture);
		requireSecretFree(capture.stdout, fragments, "captured compiled extension stdout");
		requireSecretFree(capture.stderr, fragments, "captured compiled extension stderr");
		throw error;
	}
}

async function stopExtension(capture) {
	if (!capture?.child || capture.child.exitCode !== null || capture.child.signalCode !== null)
		return;
	let closePromise = once(capture.child, "close");
	capture.child.kill("SIGTERM");
	try {
		await withTimeout(closePromise, 5_000, "compiled extension teardown timed out");
	} catch {
		if (capture.child.exitCode === null && capture.child.signalCode === null) {
			closePromise = once(capture.child, "close");
			capture.child.kill("SIGKILL");
			await withTimeout(closePromise, 5_000, "compiled extension force-teardown timed out");
		}
	}
}

async function requestJson(port, method, route, options, fragments, observedPayloads) {
	const headers = { "Content-Type": "application/json" };
	if (options?.token !== undefined) headers.Authorization = `Bearer ${options.token}`;
	const response = await fetch(`http://127.0.0.1:${port}${route}`, {
		method,
		headers,
		body: options && Object.hasOwn(options, "body") ? JSON.stringify(options.body) : undefined,
	});
	const raw = await response.text();
	observedPayloads.push(raw);
	requireSecretFree(raw, fragments, `${method} ${route} response`);
	let body;
	try {
		body = raw ? JSON.parse(raw) : {};
	} catch {
		throw new Error(`${method} ${route} returned non-JSON content`);
	}
	return { status: response.status, body };
}

async function main() {
	checkCompiledOutput();

	const secrets = {
		bridge: secretValue("bridge"),
		legacyLocal: secretValue("legacy_local"),
		legacyRemote: secretValue("legacy_remote"),
		legacyRead: secretValue("legacy_read"),
		legacyWrite: secretValue("legacy_write"),
		replacementRemoteFirst: secretValue("remote_first"),
		replacementRemoteFinal: secretValue("remote_final"),
		replacementRead: secretValue("read_final"),
		localProbe: secretValue("local_probe"),
		remoteProbeApi: secretValue("remote_probe_api"),
		remoteProbeRead: secretValue("remote_probe_read"),
		remoteProbeWrite: secretValue("remote_probe_write"),
	};
	const fragments = secretFragments(Object.values(secrets));
	failureFragments = fragments;
	const observedPayloads = [];
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pvm-configuration-e2e-"));
	const vaultDir = path.join(tempRoot, "vault");
	const relocatedVaultDir = path.join(tempRoot, "relocated-vault");
	const vaultMindDir = path.join(vaultDir, ".vault-mind");
	const configPath = path.join(vaultMindDir, "vault-mind.config.json");
	const envPath = path.join(vaultMindDir, "vault-mind.env");
	const baselineDefaultVault = {
		path: vaultDir,
		autoStart: false,
		autoSync: false,
		autoSyncTags: ["publish", "reference"],
		autoSyncMinLength: 240,
		collectionPrefix: "configuration-e2e",
		customPolicy: { preserve: true },
	};

	let localFixture;
	let remoteFixture;
	let extension;
	let failure;
	let teardownFailure;

	try {
		fs.mkdirSync(vaultMindDir, { recursive: true });
		fs.mkdirSync(relocatedVaultDir, { recursive: true });
		fs.mkdirSync(path.join(vaultDir, ".pi", "agent"), { recursive: true });

		localFixture = await createOpenAiFixture("local", ["zeta-local", "alpha-local"]);
		remoteFixture = await createOpenAiFixture("remote", ["zeta-remote", "alpha-remote"]);

		const initialConfig = {
			version: 2,
			collections: {},
			injectors: [],
			vaultMind: {
				dataDir: ".lancedb",
				embedding: {
					localUrl: `${localFixture.baseUrl}/v1/embeddings`,
					remoteUrl: `${remoteFixture.baseUrl}/v1/embeddings`,
					model: "alpha-remote",
					dim: 768,
					useTransformers: false,
					apiKey: secrets.legacyLocal,
					remoteApiKey: secrets.legacyRemote,
					remoteReadApiKey: secrets.legacyRead,
					remoteWriteApiKey: secrets.legacyWrite,
					fallback: { enabled: true },
				},
				folders: {
					inbox: "Old/Inbox",
					library: "Old/Library",
					presentations: "Old/Presentations",
					journal: "Old/Journal",
				},
				graph: { enabled: true, canvasSync: false },
				vaults: { default: baselineDefaultVault },
			},
			extensionCompatibility: {
				"pi-context": { enabled: false, includeSelection: true },
				"other-extension": { enabled: true, mode: "strict" },
			},
		};
		fs.writeFileSync(configPath, `${JSON.stringify(initialConfig, null, 2)}\n`, "utf-8");
		fs.writeFileSync(
			envPath,
			`# configuration e2e\nPVM_API_TOKEN="${secrets.bridge}"\nUNRELATED_SETTING="keep-me"\n`,
			{ encoding: "utf-8", mode: 0o600 }
		);

		extension = await startExtension(vaultDir, fragments);
		const request = (method, route, options = {}) =>
			requestJson(extension.port, method, route, options, fragments, observedPayloads);

		{
			const accepted = await request("GET", "/vm/status", { token: secrets.bridge });
			const providerRejected = await request("GET", "/vm/status", {
				token: secrets.legacyRemote,
			});
			requireEqual(accepted.status, 200, "dedicated bridge token was not accepted");
			requireEqual(accepted.body?.ok, true, "authenticated status did not report success");
			requireEqual(
				providerRejected.status,
				401,
				"legacy provider token authenticated a bridge request"
			);
			console.log("PASS bridge versus provider authentication boundary");
		}

		{
			const response = await request("GET", "/vault-mind/config", { token: secrets.bridge });
			requireEqual(response.status, 200, "config read failed");
			requireEqual(response.body?.hasToken, true, "config read did not recognize the bridge token");
			for (const key of SECRET_KEYS) {
				requireEqual(
					response.body?.config?.vaultMind?.embedding?.[LEGACY_CONFIG_KEY[key]],
					MASK,
					`config read did not redact ${key}`
				);
				requireJsonEqual(
					statusByKind(response.body, key),
					expectedStatus(key, true, "legacy-config"),
					`initial ${key} status did not report legacy ownership`
				);
			}
			console.log("PASS legacy secret redaction and ownership status");
		}

		{
			const migrated = await request("PUT", "/vm/embedding/secrets", {
				token: secrets.bridge,
				body: {
					localApiKey: null,
					remoteApiKey: secrets.replacementRemoteFirst,
					remoteReadApiKey: secrets.replacementRead,
					remoteWriteApiKey: null,
				},
			});
			requireEqual(migrated.status, 200, "legacy secret migration failed");
			requireEqual(migrated.body?.ok, true, "legacy secret migration did not report success");
			requireJsonEqual(
				mutationStatusByKind(migrated.body, "localApiKey"),
				expectedStatus("localApiKey", false, "none"),
				"local secret deletion status is incorrect"
			);
			requireJsonEqual(
				mutationStatusByKind(migrated.body, "remoteApiKey"),
				expectedStatus("remoteApiKey", true, "extension-secret-store"),
				"remote secret migration status is incorrect"
			);
			requireJsonEqual(
				mutationStatusByKind(migrated.body, "remoteReadApiKey"),
				expectedStatus("remoteReadApiKey", true, "extension-secret-store"),
				"read secret migration status is incorrect"
			);
			requireJsonEqual(
				mutationStatusByKind(migrated.body, "remoteWriteApiKey"),
				expectedStatus("remoteWriteApiKey", false, "none"),
				"write secret deletion status is incorrect"
			);

			const replaced = await request("PUT", "/vm/embedding/secrets", {
				token: secrets.bridge,
				body: { remoteApiKey: secrets.replacementRemoteFinal },
			});
			requireEqual(replaced.status, 200, "stored remote secret replacement failed");
			requireJsonEqual(
				mutationStatusByKind(replaced.body, "remoteApiKey"),
				expectedStatus("remoteApiKey", true, "extension-secret-store"),
				"remote replacement status is incorrect"
			);

			const storedEnv = fs.readFileSync(envPath, "utf-8");
			requireCondition(
				storedEnv.includes(secrets.bridge),
				"secret mutation removed the bridge token"
			);
			requireCondition(
				storedEnv.includes('UNRELATED_SETTING="keep-me"'),
				"secret mutation removed an unrelated env entry"
			);
			requireCondition(
				storedEnv.includes(secrets.replacementRemoteFinal),
				"final remote secret was not stored"
			);
			requireCondition(
				storedEnv.includes(secrets.replacementRead),
				"remote read secret was not stored"
			);
			requireCondition(
				!storedEnv.includes(secrets.replacementRemoteFirst),
				"replaced remote secret remained stored"
			);
			requireCondition(
				!storedEnv.includes("PVM_LOCAL_EMBEDDING_API_KEY="),
				"deleted local secret remained stored"
			);
			requireCondition(
				!storedEnv.includes("PVM_MODAL_WRITE_TOKEN="),
				"deleted write secret remained stored"
			);
			const storedConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
			for (const key of SECRET_KEYS) {
				requireCondition(
					!Object.hasOwn(storedConfig.vaultMind.embedding, LEGACY_CONFIG_KEY[key]),
					`legacy ${LEGACY_CONFIG_KEY[key]} remained in configuration`
				);
			}
			console.log("PASS secret migration replacement deletion and response redaction");
		}

		{
			const response = await request("POST", "/vm/embedding/probe", {
				token: secrets.bridge,
				body: {
					target: "local",
					url: `${localFixture.baseUrl}/v1/embeddings/`,
					model: "zeta-local",
					transientSecrets: { apiKey: secrets.localProbe },
				},
			});
			requireEqual(response.status, 200, "local probe failed");
			requireJsonEqual(
				response.body,
				{
					ok: true,
					target: "local",
					endpoint: localFixture.baseUrl,
					models: [
						{ id: "alpha-local", name: "alpha-local", dim: null },
						{ id: "zeta-local", name: "zeta-local", dim: null },
					],
					selectedModelAvailable: true,
					latencyMs: response.body?.latencyMs,
					error: null,
				},
				"local OpenAI-compatible response was not normalized"
			);
			requireCondition(
				Number.isFinite(response.body?.latencyMs) && response.body.latencyMs >= 0,
				"local probe latency is invalid"
			);
			requireJsonEqual(
				localFixture.calls,
				[
					{ method: "GET", path: "/api/tags", authorization: `Bearer ${secrets.localProbe}` },
					{ method: "GET", path: "/v1/models", authorization: `Bearer ${secrets.localProbe}` },
				],
				"local probe did not use the normalized discovery path and local credential"
			);
			console.log("PASS Local OpenAI-compatible probe normalization");
		}

		{
			const response = await request("POST", "/vm/embedding/probe", {
				token: secrets.bridge,
				body: {
					target: "remote",
					url: `${remoteFixture.baseUrl}/v1/embeddings`,
					model: "missing-remote",
					transientSecrets: {
						apiKey: secrets.remoteProbeApi,
						readApiKey: secrets.remoteProbeRead,
						writeApiKey: secrets.remoteProbeWrite,
					},
				},
			});
			requireEqual(response.status, 200, "remote probe failed");
			requireJsonEqual(
				response.body,
				{
					ok: true,
					target: "remote",
					endpoint: remoteFixture.baseUrl,
					models: [
						{ id: "alpha-remote", name: "alpha-remote", dim: null },
						{ id: "zeta-remote", name: "zeta-remote", dim: null },
					],
					selectedModelAvailable: false,
					latencyMs: response.body?.latencyMs,
					error: null,
				},
				"remote OpenAI-compatible response was not normalized"
			);
			requireCondition(
				Number.isFinite(response.body?.latencyMs) && response.body.latencyMs >= 0,
				"remote probe latency is invalid"
			);
			requireJsonEqual(
				remoteFixture.calls,
				[
					{ method: "GET", path: "/models", authorization: `Bearer ${secrets.remoteProbeRead}` },
					{ method: "GET", path: "/v1/models", authorization: `Bearer ${secrets.remoteProbeRead}` },
				],
				"remote probe did not use the normalized discovery path and read credential"
			);
			console.log("PASS Remote OpenAI-compatible probe normalization");
		}

		let expectedDefaultVault;
		{
			const setup = await request("POST", "/vm/setup", {
				token: secrets.bridge,
				body: {
					vault: relocatedVaultDir,
					localUrl: `${localFixture.baseUrl}/v1/embeddings`,
					remoteUrl: `${remoteFixture.baseUrl}/v1/embeddings`,
					model: "zeta-remote",
					useTransformers: false,
					folders: {
						inbox: "  Agent/Inbox  ",
						library: "Agent/Library",
						presentations: "Agent/Presentations",
						journal: "Agent/Journal",
					},
				},
			});
			requireEqual(setup.status, 200, "setup rerun failed");
			requireEqual(setup.body?.ok, true, "setup rerun did not report success");

			expectedDefaultVault = { ...baselineDefaultVault, path: relocatedVaultDir };
			const restoration = await request("PATCH", "/vm/config", {
				token: secrets.bridge,
				body: {
					vaultMind: {
						vaults: { default: expectedDefaultVault },
						embedding: {
							localUrl: `${localFixture.baseUrl}/v1/embeddings`,
							remoteUrl: `${remoteFixture.baseUrl}/v1/embeddings`,
							workspace: "configuration-e2e",
							model: "zeta-remote",
							dim: 1024,
							fallback: { enabled: true },
						},
					},
					extensionCompatibility: {
						"pi-context": { enabled: true, includeSelection: true },
						"other-extension": { enabled: true, mode: "strict" },
					},
				},
			});
			requireEqual(restoration.status, 200, "setup sibling restoration patch failed");
			requireEqual(restoration.body?.ok, true, "setup sibling restoration did not report success");
			const persisted = JSON.parse(fs.readFileSync(configPath, "utf-8"));
			requireJsonEqual(
				persisted.vaultMind.vaults.default,
				expectedDefaultVault,
				"setup rerun did not preserve every default-vault sibling"
			);
			console.log("PASS setup rerun default-vault sibling preservation");
		}

		{
			const config = await request("GET", "/vault-mind/config", { token: secrets.bridge });
			const status = await request("GET", "/vm/status", { token: secrets.bridge });
			requireEqual(config.status, 200, "final config reload failed");
			requireEqual(status.status, 200, "final status reload failed");
			requireEqual(config.body?.hasToken, true, "final config lost bridge-token status");
			requireJsonEqual(
				config.body?.config?.vaultMind?.vaults?.default,
				expectedDefaultVault,
				"final config lost default-vault siblings"
			);
			requireJsonEqual(
				config.body?.config?.vaultMind?.folders,
				{
					inbox: "Agent/Inbox",
					library: "Agent/Library",
					presentations: "Agent/Presentations",
					journal: "Agent/Journal",
				},
				"final config did not retain setup folders"
			);
			const embedding = config.body?.config?.vaultMind?.embedding;
			requireEqual(
				embedding?.localUrl,
				`${localFixture.baseUrl}/v1/embeddings`,
				"final local URL is incorrect"
			);
			requireEqual(
				embedding?.remoteUrl,
				`${remoteFixture.baseUrl}/v1/embeddings`,
				"final remote URL is incorrect"
			);
			requireEqual(embedding?.workspace, "configuration-e2e", "final workspace is incorrect");
			requireEqual(embedding?.model, "zeta-remote", "final model is incorrect");
			requireEqual(embedding?.dim, 1024, "final dimension is incorrect");
			requireJsonEqual(
				embedding?.fallback,
				{ enabled: true },
				"final fallback policy is incorrect"
			);
			for (const key of SECRET_KEYS) {
				requireCondition(
					!Object.hasOwn(embedding, LEGACY_CONFIG_KEY[key]),
					`final config retained legacy ${LEGACY_CONFIG_KEY[key]}`
				);
			}
			requireJsonEqual(
				statusByKind(config.body, "localApiKey"),
				expectedStatus("localApiKey", false, "none"),
				"final local secret status is incorrect"
			);
			requireJsonEqual(
				statusByKind(config.body, "remoteApiKey"),
				expectedStatus("remoteApiKey", true, "extension-secret-store"),
				"final remote secret status is incorrect"
			);
			requireJsonEqual(
				statusByKind(config.body, "remoteReadApiKey"),
				expectedStatus("remoteReadApiKey", true, "extension-secret-store"),
				"final remote read status is incorrect"
			);
			requireJsonEqual(
				statusByKind(config.body, "remoteWriteApiKey"),
				expectedStatus("remoteWriteApiKey", false, "none"),
				"final remote write status is incorrect"
			);
			requireEqual(status.body?.ok, true, "final status did not report success");
			requireEqual(status.body?.configured, true, "final status did not report configured");
			requireEqual(status.body?.embedding?.model, "zeta-remote", "final status model is incorrect");
			requireEqual(status.body?.embedding?.dim, 1024, "final status dimension is incorrect");
			requireEqual(
				status.body?.server?.running,
				true,
				"final status did not report a running server"
			);
			requireEqual(
				status.body?.server?.port,
				extension.port,
				"final status reported the wrong port"
			);
			console.log("PASS final config and status completion reload");
		}
	} catch (error) {
		failure = error;
	} finally {
		const cleanupErrors = [];
		const attemptCleanup = async (action) => {
			try {
				await action();
			} catch (error) {
				cleanupErrors.push(error);
			}
		};
		await attemptCleanup(() => stopExtension(extension));
		await attemptCleanup(() => closeServer(localFixture?.server));
		await attemptCleanup(() => closeServer(remoteFixture?.server));
		await attemptCleanup(async () => {
			if (extension) {
				requireSecretFree(extension.stdout, fragments, "captured compiled extension stdout");
				requireSecretFree(extension.stderr, fragments, "captured compiled extension stderr");
			}
			for (const payload of observedPayloads) {
				requireSecretFree(payload, fragments, "captured HTTP response");
			}
		});
		await attemptCleanup(async () => {
			fs.rmSync(tempRoot, { recursive: true, force: true });
			requireCondition(!fs.existsSync(tempRoot), "temporary vault cleanup failed");
		});
		teardownFailure = cleanupErrors[0];
	}

	if (failure && teardownFailure) {
		const failureMessage = failure instanceof Error ? failure.message : String(failure);
		const cleanupMessage =
			teardownFailure instanceof Error ? teardownFailure.message : String(teardownFailure);
		throw new Error(`${failureMessage}; cleanup also failed: ${cleanupMessage}`);
	}

	if (failure) throw failure;
	if (teardownFailure) throw teardownFailure;
	console.log("PASS child-output sentinel scan and deterministic teardown");
}

let exitCode = 0;
let failureFragments = [];
try {
	await main();
} catch (error) {
	exitCode = 1;
	const message = error instanceof Error ? error.message : String(error);
	if (error instanceof CompiledOutputBlocker) {
		console.error(`BLOCKED configuration-e2e: ${message}`);
	} else {
		console.error(`FAIL configuration-e2e: ${redactText(message, failureFragments)}`);
	}
}
process.exitCode = exitCode;
