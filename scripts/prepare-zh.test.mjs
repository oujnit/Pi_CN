import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { prepareZh } from "./prepare-zh.mjs";

const repository = resolve(import.meta.dirname, "..");

function createFixture() {
	const root = mkdtempSync(join(tmpdir(), "pi-cn-prepare-"));
	mkdirSync(join(root, "packages/ai/src"), { recursive: true });
	cpSync(join(repository, "packages/ai/package.json"), join(root, "packages/ai/package.json"));
	cpSync(join(repository, "packages/ai/src/models.generated.ts"), join(root, "packages/ai/src/models.generated.ts"));
	cpSync(join(repository, "packages/ai/src/providers"), join(root, "packages/ai/src/providers"), {
		recursive: true,
		filter: (source) => !source.startsWith(join(repository, "packages/ai/src/providers/data")),
	});
	cpSync(join(repository, "localization"), join(root, "localization"), { recursive: true });
	return root;
}

test("restores and validates the fork model snapshot", () => {
	const root = createFixture();
	try {
		prepareZh(root);
		assert.doesNotThrow(() => JSON.parse(readFileSync(join(root, "packages/ai/src/providers/data/openai.json"), "utf8")));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("fails clearly when the snapshot is missing", () => {
	const root = createFixture();
	try {
		rmSync(join(root, "localization/model-data/data"), { recursive: true });
		assert.throws(() => prepareZh(root), /Model snapshot data is missing/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("rejects corrupt data before replacing existing generated data", () => {
	const root = createFixture();
	try {
		const generatedData = join(root, "packages/ai/src/providers/data");
		mkdirSync(generatedData, { recursive: true });
		writeFileSync(join(generatedData, "sentinel"), "keep");
		const shard = join(root, "localization/model-data/data/openai.json");
		writeFileSync(shard, `${readFileSync(shard, "utf8")}\n`);
		assert.throws(() => prepareZh(root), /does not match its manifest hash/);
		assert.equal(readFileSync(join(generatedData, "sentinel"), "utf8"), "keep");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
