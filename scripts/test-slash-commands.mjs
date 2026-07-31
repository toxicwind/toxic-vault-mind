#!/usr/bin/env node
/**
 * SDK-based slash-command smoke test for pi-vault-mind.
 *
 * Loads the local pi-vault-mind extension via DefaultResourceLoader into an
 * in-memory pi session whose cwd is the recycvape vault, then exercises the
 * non-interactive /vm slash command tree:
 *   /vm init
 *   /vm watcher start
 *   /vm query "test"
 *   /vm collection list
 *   /vm tombstone <collection> <id>
 *   /vm discover-schema <file>
 *
 * Command outcomes are verified via captured notifications and side effects.
 * Exit code = number of failures.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

const VAULT_PATH = "/Users/kylebrodeur/workspace/recycvape/ReturnVape";
const EXTENSION_PATH = path.resolve(import.meta.dirname, "../dist/index.js");
const DISCOVER_FILE = path.join(VAULT_PATH, "collections", "main.jsonl");

let failures = 0;
const pass = (name, detail = "") => console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail = "") => {
	failures++;
	console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
};
const assert = (name, condition, detail = "") => {
	if (condition) {
		pass(name, detail);
		return true;
	}
	fail(name, detail);
	return false;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
	console.log("SDK slash-command smoke tests");
	console.log(`Vault: ${VAULT_PATH}`);
	console.log(`Extension: ${EXTENSION_PATH}`);

	process.chdir(VAULT_PATH);

	const notifications = [];
	const captureNotify = (message, type = "info") => notifications.push({ message, type });

	const extModule = await import(EXTENSION_PATH);
	const vaultMindExtensionFactory = extModule.default;

	const resourceLoader = new DefaultResourceLoader({
		cwd: VAULT_PATH,
		agentDir: getAgentDir(),
		noExtensions: true,
		extensionFactories: [vaultMindExtensionFactory],
	});
	await resourceLoader.reload();

	const { session, extensionsResult } = await createAgentSession({
		cwd: VAULT_PATH,
		resourceLoader,
		sessionManager: SessionManager.inMemory(VAULT_PATH),
		noTools: "all",
	});

	if (extensionsResult.errors.length > 0) {
		console.error("Extension load errors:", extensionsResult.errors);
	}

	await session.bindExtensions({
		uiContext: {
			notify: captureNotify,
			select: async () => undefined,
			confirm: async () => false,
			input: async () => undefined,
			onTerminalInput: () => () => {},
			setStatus: () => {},
			setWorkingMessage: () => {},
			setWorkingVisible: () => {},
			setWorkingIndicator: () => {},
			setHiddenThinkingLabel: () => {},
			setWidget: () => {},
			setFooter: () => {},
			setHeader: () => {},
			setTitle: () => {},
			custom: async () => undefined,
			pasteToEditor: () => {},
			setEditorText: () => {},
			getEditorText: () => "",
			editor: async () => undefined,
			addAutocompleteProvider: () => {},
			setEditorComponent: () => {},
			getEditorComponent: () => undefined,
			theme: undefined,
			getAllThemes: () => [],
		},
		mode: "json",
	});

	// Subscribe to session events and log them.
	const events = [];
	session.subscribe((event) => {
		events.push(event);
		console.log(`  [event] ${event.type}`);
	});

	async function runCommand(command) {
		notifications.length = 0;
		try {
			await session.prompt(command, { expandPromptTemplates: true });
			await sleep(200);
			return { ok: true, text: notifications.map((n) => n.message).join("\n") };
		} catch (error) {
			return {
				ok: false,
				error: error?.message ?? String(error),
				text: notifications.map((n) => n.message).join("\n"),
			};
		}
	}

	// 1. /vm init
	const initResult = await runCommand("/vm init");
	if (!assert("/vm init completes", initResult.ok, initResult.error)) failures++;

	// 2. /vm watcher start
	const watcherResult = await runCommand("/vm watcher start");
	if (!assert("/vm watcher start completes", watcherResult.ok, watcherResult.error)) failures++;

	// 3. /vm collection list
	const listResult = await runCommand("/vm collection list");
	const listOk =
		listResult.ok &&
		(listResult.text.includes("main") || listResult.text.includes("Configured collections"));
	if (!assert("/vm collection list lists collections", listOk, listResult.text.slice(0, 80)))
		failures++;

	// 4. /vm query "test"
	const queryResult = await runCommand('/vm query "test"');
	const queryOk =
		queryResult.ok &&
		(queryResult.text.includes("Search results") || queryResult.text.includes("No results"));
	if (!assert("/vm query returns search response", queryOk, queryResult.text.slice(0, 80)))
		failures++;

	// Seed a disposable entry so tombstone has something to redact.
	const tombstoneId = `pvm-test-${Date.now()}`;
	const mainJsonl = path.join(VAULT_PATH, "collections", "main.jsonl");
	const tombstoneEntry = {
		id: tombstoneId,
		domain: "test",
		source: "slash-command-test",
		fact: "Disposable test entry for slash-command validation.",
		tag: "test",
		artifact: "",
	};
	fs.appendFileSync(mainJsonl, `${JSON.stringify(tombstoneEntry)}\n`, "utf-8");

	// 5. /vm tombstone main <id>
	const tombstoneResult = await runCommand(`/vm tombstone main ${tombstoneId}`);
	const tombstoneOk = tombstoneResult.ok && tombstoneResult.text.includes("Tombstoned");
	if (!assert("/vm tombstone redacts entry", tombstoneOk, tombstoneResult.text.slice(0, 80)))
		failures++;

	// 6. /vm discover-schema <file>
	const discoverResult = await runCommand(`/vm discover-schema ${DISCOVER_FILE}`);
	const discoverOk =
		discoverResult.ok &&
		(discoverResult.text.includes("Discovered schema") || discoverResult.text.includes("schema"));
	if (!assert("/vm discover-schema discovers schema", discoverOk, discoverResult.text.slice(0, 80)))
		failures++;

	console.log("\n----------------------------------------");
	console.log(
		`${failures === 0 ? "✅ ALL SLASH-COMMAND CHECKS PASSED" : `❌ ${failures} SLASH-COMMAND CHECK(S) FAILED`}`
	);
	console.log(`Events captured: ${events.length}`);

	session.dispose();
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("\n❌ test-slash-commands aborted:", err?.message ?? err);
	process.exit(1);
});
