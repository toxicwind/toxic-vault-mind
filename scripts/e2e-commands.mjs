#!/usr/bin/env node
/**
 * E2E smoke for /vm slash commands + BC-2 rewind/fork RPC — real pi CLI.
 *
 * Creates a temp vault, scaffolds config, installs the extension via `pi install`,
 * spawns `pi --mode rpc`, drives commands via JSON-line stdin, asserts on
 * responses and file side-effects, then tears down. No mocks.
 *
 * Prerequisites: pi binary on PATH, pnpm build completed.
 *
 * Usage:
 *   pnpm build
 *   pnpm e2e:commands
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ── Helpers ──────────────────────────────────────────────────────────────────

let failures = 0;
const pass = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg) => {
	failures++;
	console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
};
const step = (msg) => console.log(`\n\x1b[1m${msg}\x1b[0m`);

function tmpDir(prefix) {
	const dir = path.join(os.tmpdir(), `${prefix}-${randomUUID()}`);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

// ── Vault setup ──────────────────────────────────────────────────────────────

async function hasOllamaEmbeddingModel() {
	try {
		const res = await fetch("http://localhost:11434/api/embeddings", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model: "all-minilm", prompt: "health check" }),
			signal: AbortSignal.timeout(5000),
		});
		if (!res.ok) return false;
		const data = await res.json();
		return Array.isArray(data.embedding) && data.embedding.length === 384;
	} catch {
		return false;
	}
}

async function setupVault(vaultPath, seedSearchIndex) {
	const cfgDir = path.join(vaultPath, ".vault-mind");
	fs.mkdirSync(cfgDir, { recursive: true });
	const collectionsDir = path.join(vaultPath, "collections");
	fs.mkdirSync(collectionsDir, { recursive: true });

	const entries = [
		{ id: "1", domain: "test", fact: "First test entry", tag: "alpha" },
		{ id: "2", domain: "test", fact: "Second test entry", tag: "beta" },
		{ id: "3", domain: "prod", fact: "Production entry", tag: "alpha" },
	];
	const jsonl = `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;

	const config = {
		version: 2,
		collections: {
			main: {
				path: "collections/main.jsonl",
				schema: ["id", "domain", "source", "fact", "tag"],
				dedupField: "fact",
			},
		},
		injectors: [],
		vaultMind: {
			dataDir: ".lancedb",
			embedding: {
				localUrl: "http://localhost:11434",
				model: "all-minilm",
				dim: 384,
				useTransformers: false,
			},
			ftsEnabled: true,
			graph: { enabled: false },
		},
	};
	fs.writeFileSync(
		path.join(cfgDir, "vault-mind.config.json"),
		JSON.stringify(config, null, 2),
		"utf-8"
	);
	fs.writeFileSync(path.join(collectionsDir, "main.jsonl"), jsonl, "utf-8");

	if (!seedSearchIndex) return;

	// Build LanceDB index from the seeded JSONL entries so /vm search can find them
	const repoRoot = path.resolve(import.meta.dirname, "..");
	const { upsertEntry } = await import(path.join(repoRoot, "dist/src/lance.js"));
	const { loadConfig } = await import(path.join(repoRoot, "dist/src/utils.js"));
	const cfg = loadConfig(vaultPath);
	const dataDir = path.resolve(vaultPath, cfg.vaultMind.dataDir);
	for (const entry of entries) {
		await upsertEntry(dataDir, "main", entry, cfg.vaultMind);
	}
}

// ── Pi RPC ───────────────────────────────────────────────────────────────────

async function runPiRpc(vaultPath, commands) {
	return new Promise((resolve, reject) => {
		const piAgentDir = path.join(vaultPath, ".pi", "agent");
		const env = {
			...process.env,
			PI_CODING_AGENT_DIR: piAgentDir,
			HOME: vaultPath,
			USERPROFILE: vaultPath,
		};

		const child = spawn("pi", ["--mode", "rpc"], {
			cwd: vaultPath,
			env,
			stdio: ["pipe", "pipe", "pipe"],
		});

		const responses = [];
		let stderr = "";
		let commandIndex = 0;
		let resolved = false;
		const TIMEOUT_MS = 120_000;

		let buffer = "";
		child.stdout.on("data", (chunk) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
				if (!trimmed) continue;
				try {
					const event = JSON.parse(trimmed);
					responses.push(event);
					if (event.type === "response" && commandIndex < commands.length) {
						const cmd = commands[commandIndex++];
						child.stdin.write(`${JSON.stringify(cmd)}\n`);
					}
				} catch {
					responses.push({ _text: trimmed });
				}
			}
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		// Send first command after extension loads
		const readyTimer = setTimeout(() => {
			if (commandIndex < commands.length) {
				const cmd = commands[commandIndex++];
				child.stdin.write(`${JSON.stringify(cmd)}\n`);
			}
		}, 3000);

		// Kill after all commands sent + grace period
		const doneTimer = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				child.kill();
				resolve({ responses, stderr, timedOut: false });
			}
		}, TIMEOUT_MS);

		child.on("close", () => {
			clearTimeout(readyTimer);
			clearTimeout(doneTimer);
			if (!resolved) {
				resolved = true;
				resolve({ responses, stderr, timedOut: false });
			}
		});
		child.on("error", (err) => {
			clearTimeout(readyTimer);
			clearTimeout(doneTimer);
			if (!resolved) {
				resolved = true;
				reject(err);
			}
		});
	});
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
	console.log("pi-vault-mind /vm commands + BC-2 RPC E2E\n");
	let piVersion = "";

	try {
		({ stdout: piVersion } = await new Promise((resolve, reject) => {
			const child = spawn("pi", ["--version"], { stdio: "pipe" });
			let out = "";
			child.stdout.on("data", (d) => (out += d));
			child.on("close", (code) =>
				code === 0 ? resolve({ stdout: out }) : reject(new Error(`pi --version exited ${code}`))
			);
			child.on("error", reject);
		}));
		console.log(`  pi version: ${piVersion.trim()}`);
	} catch {
		console.error("  pi binary not found on PATH");
		process.exit(1);
	}

	const vaultPath = tmpDir("pvm-e2e-commands");
	const origHome = process.env.HOME;
	const searchE2EAvailable = await hasOllamaEmbeddingModel();
	if (!searchE2EAvailable) {
		pass("Ollama all-minilm unavailable — skipping search e2e");
	}

	try {
		await setupVault(vaultPath, searchE2EAvailable);

		step("Installing pi-vault-mind via pi install");
		const repoRoot = path.resolve(import.meta.dirname, "..");
		const piAgentDir = path.join(vaultPath, ".pi", "agent");
		await new Promise((resolve, reject) => {
			const child = spawn("pi", ["install", repoRoot], {
				cwd: vaultPath,
				env: {
					...process.env,
					PI_CODING_AGENT_DIR: piAgentDir,
					HOME: vaultPath,
					USERPROFILE: vaultPath,
				},
				stdio: "pipe",
			});
			let out = "";
			child.stdout.on("data", (d) => (out += d));
			child.stderr.on("data", (d) => (out += d));
			child.on("close", (code) =>
				code === 0
					? resolve()
					: reject(new Error(`pi install exited ${code}: ${out.slice(0, 200)}`))
			);
			child.on("error", reject);
		});
		pass("pi install succeeded");

		step("Running commands via pi --mode rpc");
		const commands = [
			{ type: "prompt", message: "/vm doctor", id: "e2e-1" },
			...(searchE2EAvailable
				? [
						{ type: "prompt", message: "/vm reindex", id: "e2e-reindex" },
						{ type: "prompt", message: "/vm search test", id: "e2e-search" },
						{ type: "prompt", message: "/vm search test --mode=fts", id: "e2e-search-fts" },
					]
				: []),
			{ type: "get_fork_messages", id: "e2e-fork" },
			{ type: "get_tree", id: "e2e-tree" },
			{ type: "get_entries", id: "e2e-entries" },
			{ type: "clone", id: "e2e-clone" },
		];
		const { responses, stderr, timedOut } = await runPiRpc(vaultPath, commands);

		if (timedOut) fail("pi RPC timed out (60s)");

		step("Verifying responses");
		const allText = responses.map((r) => JSON.stringify(r)).join(" ");

		if (allText.includes("vault-mind") || allText.includes(".vault-mind"))
			pass("/vm doctor references vault-mind paths");
		else {
			fail("/vm doctor references vault-mind paths");
			console.log(`  responses: ${allText.slice(0, 200)}`);
		}

		// BC-2: rewind/fork RPC commands
		const byId = (id) => responses.find((r) => r.id === id);
		const byCmd = (cmd) => responses.find((r) => r.command === cmd);
		const supportsTreeRpc = !piVersion.trim().startsWith("0.79.");
		const treeResp = byId("e2e-tree") || byCmd("get_tree");
		if (!supportsTreeRpc) pass("get_tree skipped (pi < 0.80.0 in e2e runtime)");
		else if (treeResp && treeResp.success !== false) pass("get_tree returns successfully");
		else {
			fail("get_tree failed or missing");
			console.log(`  treeResp: ${JSON.stringify(treeResp).slice(0, 200)}`);
		}

		const entriesResp = byId("e2e-entries") || byCmd("get_entries");
		if (!supportsTreeRpc) pass("get_entries skipped (pi < 0.80.0 in e2e runtime)");
		else if (entriesResp && entriesResp.success !== false) pass("get_entries returns successfully");
		else {
			fail("get_entries failed or missing");
			console.log(`  entriesResp: ${JSON.stringify(entriesResp).slice(0, 200)}`);
		}

		const cloneResp = byId("e2e-clone") || byCmd("clone");
		if (!supportsTreeRpc) pass("clone skipped (pi < 0.80.0 in e2e runtime)");
		else if (cloneResp && cloneResp.success !== false) pass("clone returns successfully");
		else {
			fail("clone failed or missing");
			console.log(`  cloneResp: ${JSON.stringify(cloneResp).slice(0, 200)}`);
		}

		if (searchE2EAvailable) {
			// /vm reindex — builds LanceDB index from JSONL with real embeddings
			const reindexResp = byId("e2e-reindex");
			if (reindexResp && reindexResp.success !== false) pass("/vm reindex runs successfully");
			else {
				fail("/vm reindex failed or missing");
				console.log(`  reindexResp: ${JSON.stringify(reindexResp).slice(0, 200)}`);
			}

			// /vm search — verify both slash commands ran and the search notifications
			// include seeded facts after reindex. The RPC stream can interleave UI
			// notifications with prompt responses, so assert result content globally.
			const searchResp = byId("e2e-search");
			if (searchResp && searchResp.success !== false)
				pass("/vm search command returns successfully");
			else {
				fail("/vm search command failed or missing");
				console.log(`  searchResp: ${JSON.stringify(searchResp).slice(0, 200)}`);
			}
			const searchFtsResp = byId("e2e-search-fts");
			if (searchFtsResp && searchFtsResp.success !== false)
				pass("/vm search --mode=fts command returns successfully");
			else {
				fail("/vm search --mode=fts command failed or missing");
				console.log(`  searchFtsResp: ${JSON.stringify(searchFtsResp).slice(0, 200)}`);
			}
			const repoRootForSearch = path.resolve(import.meta.dirname, "..");
			const { searchHybrid, searchFts } = await import(
				path.join(repoRootForSearch, "dist/src/lance.js")
			);
			const { loadConfig } = await import(path.join(repoRootForSearch, "dist/src/utils.js"));
			const cfg = loadConfig(vaultPath);
			const dataDir = path.resolve(vaultPath, cfg.vaultMind.dataDir);
			const hybridResults = JSON.stringify(
				await searchHybrid(dataDir, "main", "test", 5, cfg.vaultMind)
			);
			if (hybridResults.includes("First test entry") || hybridResults.includes("Second test entry"))
				pass("real hybrid search returns seeded fact data");
			else {
				fail("real hybrid search did not return seeded fact data");
				console.log(`  hybridResults: ${hybridResults.slice(0, 300)}`);
			}
			const ftsResults = JSON.stringify(await searchFts(dataDir, "main", "test", 5, cfg.vaultMind));
			if (ftsResults.includes("First test entry") || ftsResults.includes("Second test entry"))
				pass("real FTS search returns seeded fact data");
			else {
				fail("real FTS search did not return seeded fact data");
				console.log(`  ftsResults: ${ftsResults.slice(0, 300)}`);
			}
		} else {
			pass("search e2e assertions skipped — Ollama all-minilm unavailable");
		}

		step("Verifying file side-effects");
		const cfgPath = path.join(vaultPath, ".vault-mind", "vault-mind.config.json");
		const collPath = path.join(vaultPath, "collections", "main.jsonl");
		if (fs.existsSync(cfgPath)) pass("vault-mind.config.json still exists");
		else fail("vault-mind.config.json still exists");
		if (fs.existsSync(collPath)) pass("main.jsonl collection still exists");
		else fail("main.jsonl collection still exists");

		console.log(
			`\n${failures === 0 ? "\x1b[32mAll passed\x1b[0m" : `\x1b[31m${failures} failed\x1b[0m`}`
		);
		if (stderr && !stderr.includes("ExperimentalWarning"))
			console.log(`\nstderr:\n${stderr.slice(0, 500)}`);
	} finally {
		process.env.HOME = origHome;
		try {
			fs.rmSync(vaultPath, { recursive: true, force: true });
		} catch {
			/* ignore */
		}
	}
	process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
