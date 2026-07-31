#!/usr/bin/env node
/**
 * Live E2E smoke for the Modal embedding service — drives the *shipped* client.
 *
 * This is the TypeScript-client counterpart to `modal/client_example.py`: it
 * imports the compiled `dist/src/modal-client.js` (the exact class the extension
 * ships) and exercises the full HTTP contract against a real deployment, so a
 * pass proves the production client ↔ live server round-trip — not a parallel
 * reimplementation.
 *
 * It is HTTP-only (no LanceDB), so it runs anywhere Node can reach the deploy.
 * The local-store half of sync (export → `.lancedb`) is exercised by the
 * `/vm modal sync` walkthrough in docs/E2E_MANUAL_TEST.md.
 *
 * Usage:
 *   pnpm build                       # produces dist/src/modal-client.js
 *   export PVM_MODAL_URL="https://<workspace>--pi-vault-mind-embed-embeddingservice-fastapi-app.modal.run"
 *   export PVM_API_TOKEN="<the pi-vault-mind-auth secret>"
 *   pnpm e2e:modal                   # or: node scripts/modal-e2e-smoke.mjs
 *
 * Optional env:
 *   PVM_MODEL       embedder key (default: embeddinggemma)
 *   PVM_COLLECTION  collection for the bulk-job + export (default: unique per run)
 *
 * Exit code 0 = all checks passed, 1 = a check failed or env is missing.
 */

import { ModalEmbeddingClient } from "../dist/src/modal-client.js";

const URL = process.env.PVM_MODAL_URL?.replace(/\/$/, "");
const TOKEN = process.env.PVM_API_TOKEN;
const MODEL = process.env.PVM_MODEL || "embeddinggemma";
// Unique per run by default: the server-side LanceDB is persistent on the
// Volume, so a shared/static collection could carry leftover or concurrent
// rows and break the exact row-count + paging assertions. Override with
// PVM_COLLECTION to target a known collection.
const COLLECTION =
	process.env.PVM_COLLECTION || `e2e-smoke-${Math.random().toString(36).slice(2, 9)}`;

if (!URL || !TOKEN) {
	console.error(
		"Missing env. Set PVM_MODAL_URL and PVM_API_TOKEN, then re-run.\n" +
			'  export PVM_MODAL_URL="https://<workspace>--pi-vault-mind-embed-embeddingservice-fastapi-app.modal.run"\n' +
			'  export PVM_API_TOKEN="<pi-vault-mind-auth secret>"'
	);
	process.exit(1);
}

const client = new ModalEmbeddingClient({ baseUrl: URL, apiToken: TOKEN });

let failures = 0;
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
	failures++;
	console.log(`  ✗ ${msg}`);
};
const step = (msg) => console.log(`\n${msg}`);

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
	console.log(
		`Modal live E2E smoke\n  url:        ${URL}\n  model:      ${MODEL}\n  collection: ${COLLECTION}`
	);

	// 1. health
	step("1. health");
	const health = await client.health();
	health?.ok
		? pass(`ok, default_model=${health.default_model}`)
		: fail(`unexpected: ${JSON.stringify(health)}`);

	// 2. models registry — resolve the native dim up front
	step("2. models");
	const reg = await client.models();
	const info = reg.models.find((m) => m.key === MODEL);
	if (!info) {
		fail(`model "${MODEL}" not in registry (have: ${reg.models.map((m) => m.key).join(", ")})`);
	} else {
		pass(`${MODEL}: backend=${info.backend} native_dim=${info.native_dim} enabled=${info.enabled}`);
	}
	const expectedDim = info?.native_dim;

	// 3. on-demand embed (query)
	step("3. embed (task=query)");
	const emb = await client.embed(["how long do tokens last?"], { model: MODEL, task: "query" });
	const dimOk =
		emb.dim === emb.vectors[0]?.length && (expectedDim == null || emb.dim === expectedDim);
	dimOk
		? pass(`model=${emb.model} dim=${emb.dim} (matches native + vector length)`)
		: fail(`dim mismatch: dim=${emb.dim} vec.len=${emb.vectors[0]?.length} native=${expectedDim}`);

	// 4. bulk job → wait → status
	step("4. bulk job submit + wait");
	const records = [
		{ id: "e2e-1", text: "JWT tokens expire after one hour.", metadata: { tag: "auth" } },
		{ id: "e2e-2", text: "Refresh tokens live for 30 days.", metadata: { tag: "auth" } },
		{ id: "e2e-3", text: "Sessions are revoked on password change.", metadata: { tag: "auth" } },
	];
	const submit = await client.submitJob(COLLECTION, records, { model: MODEL });
	pass(`submitted job_id=${submit.job_id} total=${submit.total}`);
	const final = await client.waitForJob(submit.job_id);
	final.status === "done" && final.processed === records.length
		? pass(`job done ${final.processed}/${final.total} (model=${final.model} dim=${final.dim})`)
		: fail(
				`job ended status=${final.status} ${final.processed}/${final.total} err=${final.error ?? ""}`
			);

	// 5. listJobs — the job we just ran should be present
	step("5. listJobs");
	const list = await client.listJobs(10);
	list.jobs.some((j) => j.collection === COLLECTION)
		? pass(`listed ${list.count} job(s); collection present`)
		: fail(`our collection "${COLLECTION}" not in job list`);

	// 6. sync collections — the namespace should now exist
	step("6. sync/collections");
	const cols = await client.syncCollections();
	const ns = cols.find((c) => c.collection === COLLECTION && c.model === final.model);
	ns
		? pass(`namespace ${ns.table} rows=${ns.rows} dim=${ns.dim}`)
		: fail(`namespace for ${COLLECTION}/${final.model} missing`);

	// 7. export drain — every row carries a vector of the right dim, watermark advances
	step("7. sync/export (drain)");
	const seen = new Map();
	let pages = 0;
	const finalWatermark = await client.exportAll(
		COLLECTION,
		(rows) => {
			pages++;
			for (const r of rows) seen.set(r.id, r);
		},
		{ model: final.model, dim: final.dim, limit: 2 }
	);
	const all = [...seen.values()];
	const everyVector =
		all.length > 0 && all.every((r) => Array.isArray(r.vector) && r.vector.length === final.dim);
	const gotAll = all.length === records.length;
	const idsOk = eq([...seen.keys()].sort(), records.map((r) => r.id).sort());
	gotAll && idsOk
		? pass(
				`drained ${all.length} row(s) over ${pages} page(s); all ids present; watermark=${finalWatermark}`
			)
		: fail(
				`expected ${records.length} ids ${JSON.stringify(records.map((r) => r.id))}, got ${JSON.stringify([...seen.keys()])}`
			);
	everyVector
		? pass(`every row carries a ${final.dim}-dim vector`)
		: fail("some rows missing a vector or wrong dim");

	// 8. incremental re-export from the final watermark → nothing new
	step("8. incremental re-export (idempotent)");
	const inc = await client.exportSince(COLLECTION, {
		model: final.model,
		dim: final.dim,
		since: finalWatermark,
	});
	inc.rows.length === 0 && inc.done
		? pass("re-export from watermark returns 0 rows (idempotent)")
		: fail(`expected 0 new rows, got ${inc.rows.length} (done=${inc.done})`);

	// summary
	console.log(`\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error(`\n❌ smoke aborted: ${err?.message ?? err}`);
	process.exit(1);
});
