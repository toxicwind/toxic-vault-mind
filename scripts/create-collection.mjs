#!/usr/bin/env node

import process from "node:process";
import { upsertCollection } from "../dist/src/collection-injector-manager.js";

const ALLOWED_OPTIONS = new Set([
	"--name",
	"--path",
	"--schema",
	"--dedup-field",
	"--dedup-mode",
	"--dedup-threshold",
]);

function parseOptions(args) {
	const options = {};
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (!argument.startsWith("--")) {
			throw new Error(`Unexpected positional argument: ${argument}`);
		}
		const equalsIndex = argument.indexOf("=");
		const option = equalsIndex >= 0 ? argument.slice(0, equalsIndex) : argument;
		if (!ALLOWED_OPTIONS.has(option)) throw new Error(`Unknown option: ${option}`);
		if (Object.hasOwn(options, option))
			throw new Error(`Option specified more than once: ${option}`);

		let value;
		if (equalsIndex >= 0) {
			value = argument.slice(equalsIndex + 1);
		} else {
			value = args[index + 1];
			if (value !== undefined) index += 1;
		}
		if (value === undefined || value.length === 0)
			throw new Error(`Option requires a value: ${option}`);
		options[option] = value;
	}
	return options;
}

function numericOption(options, option) {
	if (options[option] === undefined) return undefined;
	const value = Number(options[option]);
	if (!Number.isFinite(value)) throw new Error(`${option} must be a number.`);
	return value;
}

try {
	const options = parseOptions(process.argv.slice(2));
	const requiredOptions = ["--name", "--path", "--schema"];
	const missing = requiredOptions.filter((option) => !options[option]?.trim());
	if (missing.length > 0) throw new Error(`Missing required options: ${missing.join(", ")}`);

	const collection = upsertCollection(process.cwd(), {
		name: options["--name"],
		path: options["--path"],
		schema: options["--schema"].split(",").map((field) => field.trim()),
		...(options["--dedup-field"] !== undefined ? { dedupField: options["--dedup-field"] } : {}),
		...(options["--dedup-mode"] !== undefined ? { dedupMode: options["--dedup-mode"] } : {}),
		...(options["--dedup-threshold"] !== undefined
			? { dedupThreshold: numericOption(options, "--dedup-threshold") }
			: {}),
	});

	console.log(`Created collection "${collection.name}".`);
	console.log(`Path: ${collection.path}`);
	console.log(`Schema: ${collection.schema.join(", ")}`);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
