#!/usr/bin/env node

import process from "node:process";
import { upsertInjector } from "../dist/src/collection-injector-manager.js";

const ALLOWED_OPTIONS = new Set([
	"--name",
	"--regex",
	"--collection",
	"--capture-group",
	"--filter-field",
	"--artifact-path",
	"--template",
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
	const requiredOptions = ["--name", "--regex", "--collection"];
	const missing = requiredOptions.filter((option) => !options[option]?.trim());
	if (missing.length > 0) throw new Error(`Missing required options: ${missing.join(", ")}`);

	const injector = upsertInjector(process.cwd(), {
		name: options["--name"],
		regex: options["--regex"],
		collection: options["--collection"],
		...(options["--capture-group"] !== undefined
			? { captureGroup: numericOption(options, "--capture-group") }
			: {}),
		...(options["--filter-field"] !== undefined ? { filterField: options["--filter-field"] } : {}),
		...(options["--artifact-path"] !== undefined
			? { artifactPath: options["--artifact-path"] }
			: {}),
		...(options["--template"] !== undefined ? { template: options["--template"] } : {}),
	});

	console.log(`Created injector "${injector.name}".`);
	console.log(`Collection: ${injector.collection}`);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
