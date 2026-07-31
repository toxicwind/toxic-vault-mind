#!/usr/bin/env node
/**
 * Generates config-keys.json from the canonical TS source.
 *
 * Reads src/config-keys.ts and writes JSON to:
 *   1. config-keys.json (repo root — for reference)
 *   2. packages/obsidian/src/config-keys.json (for plugin import)
 *
 * Run before building the plugin.
 * Usage: node scripts/generate-config-keys-json.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const src = readFileSync(resolve(repoRoot, "src/config-keys.ts"), "utf-8");

function extractArray(name) {
	const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, "m");
	const arrMatch = src.match(re);
	if (!arrMatch) throw new Error(`Could not find ${name} in src/config-keys.ts`);
	const items = [];
	for (const m of arrMatch[1].matchAll(/"([^"]+)"/g)) {
		items.push(m[1]);
	}
	return items;
}

const embeddingFlatKeys = extractArray("EMBEDDING_FLAT_KEYS");
const vaultMindConfigKeys = extractArray("VAULT_MIND_CONFIG_KEYS");

const json = `${JSON.stringify({ embeddingFlatKeys, vaultMindConfigKeys }, null, "\t")}\n`;

const rootOut = resolve(repoRoot, "config-keys.json");
const pluginOut = resolve(repoRoot, "packages/obsidian/src/config-keys.json");

writeFileSync(rootOut, json);
console.log(`Wrote ${rootOut}`);

writeFileSync(pluginOut, json);
console.log(`Wrote ${pluginOut}`);
