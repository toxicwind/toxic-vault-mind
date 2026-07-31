#!/usr/bin/env node
/**
 * Generates extension-packages.json from the canonical TS source.
 *
 * Reads src/extension-packages.ts and writes JSON to:
 *   1. extension-packages.json (repo root — for shell scripts)
 *   2. packages/obsidian/src/extension-packages.json (for plugin import)
 *   3. packages/obsidian-ui/src/extension-packages.json (for sandbox import)
 * Run before building the plugin or running shell scripts.
 * Usage: node scripts/generate-extension-packages-json.mjs
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Dynamic import of the TS source — Node 20+ with --experimental-strip-types
// or tsx handles this. We use a simple regex-based extraction as a fallback
// that works without any loader flags.
import { readFileSync } from "node:fs";

const src = readFileSync(resolve(repoRoot, "src/extension-packages.ts"), "utf-8");

function extractArray(name) {
	const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`, "m");
	const arrMatch = src.match(re);
	if (!arrMatch) throw new Error(`Could not find ${name} in src/extension-packages.ts`);
	// Parse each quoted string from the array body
	const items = [];
	for (const m of arrMatch[1].matchAll(/"([^"]+)"/g)) {
		items.push(m[1]);
	}
	return items;
}

const required = extractArray("PI_REQUIRED_EXTENSIONS");
const optional = extractArray("PI_OPTIONAL_EXTENSIONS");

const json = `${JSON.stringify({ required, optional }, null, "\t")}\n`;

const rootOut = resolve(repoRoot, "extension-packages.json");
const pluginOut = resolve(repoRoot, "packages/obsidian/src/extension-packages.json");
const sandboxOut = resolve(repoRoot, "packages/obsidian-ui/src/extension-packages.json");

writeFileSync(rootOut, json);
console.log(`Wrote ${rootOut}`);

writeFileSync(pluginOut, json);
console.log(`Wrote ${pluginOut}`);

writeFileSync(sandboxOut, json);
console.log(`Wrote ${sandboxOut}`);
