import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGeneratedModelData } from "../packages/ai/scripts/model-data.ts";

export function prepareZh(root = resolve(dirname(fileURLToPath(import.meta.url)), "..")) {
	const snapshot = join(root, "localization/model-data");
	const metadataPath = join(snapshot, "snapshot.json");
	const dataPath = join(snapshot, "data");
	if (!existsSync(metadataPath)) throw new Error(`Model snapshot metadata is missing: ${metadataPath}`);
	if (!existsSync(dataPath)) throw new Error(`Model snapshot data is missing: ${dataPath}`);
	const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
	const version = JSON.parse(readFileSync(join(root, "packages/ai/package.json"), "utf8")).version;
	if (metadata.upstreamVersion !== version) throw new Error(`Snapshot version ${metadata.upstreamVersion} does not match ${version}`);
	const packageRoot = join(root, "packages/ai");
	const temporary = mkdtempSync(join(packageRoot, ".prepare-zh-"));
	try {
		mkdirSync(join(temporary, "src/providers"), { recursive: true });
		cpSync(join(packageRoot, "src/models.generated.ts"), join(temporary, "src/models.generated.ts"));
		const generatedDataPath = join(packageRoot, "src/providers/data");
		cpSync(join(packageRoot, "src/providers"), join(temporary, "src/providers"), {
			recursive: true,
			filter: (source) => source !== generatedDataPath && !source.startsWith(`${generatedDataPath}${sep}`),
		});
		cpSync(dataPath, join(temporary, "src/providers/data"), { recursive: true });
		validateGeneratedModelData(temporary);
		const destination = join(packageRoot, "src/providers/data");
		const backup = join(temporary, "previous-data");
		if (existsSync(destination)) renameSync(destination, backup);
		try {
			renameSync(join(temporary, "src/providers/data"), destination);
		} catch (error) {
			if (existsSync(backup)) renameSync(backup, destination);
			throw error;
		}
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		prepareZh();
		console.log("Pi_CN model snapshot restored and verified (no network access).");
	} catch (error) {
		console.error(`Cannot prepare Pi_CN: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	}
}
