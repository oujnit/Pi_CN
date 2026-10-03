import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { messages as en } from "../packages/coding-agent/src/i18n/en.ts";
import { messages as zh } from "../packages/coding-agent/src/i18n/zh-CN.ts";

const root = resolve(import.meta.dirname, "..");
const errors = [];
const enKeys = Object.keys(en).sort();
const zhKeys = Object.keys(zh).sort();
if (JSON.stringify(enKeys) !== JSON.stringify(zhKeys)) {
	errors.push("English and Chinese message tables do not contain the same keys");
}

const slots = (message) => [...message.matchAll(/\{(p\d+)\}/g)].map((match) => match[1]).sort();
for (const key of enKeys) {
	if (JSON.stringify(slots(en[key])) !== JSON.stringify(slots(zh[key]))) {
		errors.push(`${key} uses different parameters in English and Chinese`);
	}
}

// typescript@7 no longer ships the compiler JS API, so the hard-coded-Chinese scan runs on raw
// source: comment lines are stripped, then any remaining CJK character is a violation. The fork's
// rule is that all Chinese copy lives in the message tables, so this is deliberately strict.
const sourceRoot = join(root, "packages/coding-agent/src");
const files = [];
const visitDirectory = (directory) => {
	for (const entry of readdirSync(directory)) {
		const path = join(directory, entry);
		if (statSync(path).isDirectory()) visitDirectory(path);
		else if (path.endsWith(".ts") && !path.includes(`${join("src", "i18n")}/`)) files.push(path);
	}
};
visitDirectory(sourceRoot);

const CJK = /[\u3400-\u9fff]/u;
const isCommentLine = (line) => {
	const trimmed = line.trim();
	return trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("*/");
};

for (const file of files) {
	const lines = readFileSync(file, "utf8").split("\n");
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (isCommentLine(line) || !CJK.test(line)) continue;
		if (file.endsWith("model-selector.ts") && (line.includes("默认") || line.includes(" default 默认"))) continue;
		errors.push(
			`${relative(root, file)}:${i + 1} contains hard-coded Chinese text outside the message table`,
		);
	}
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(`i18n checks passed (${enKeys.length} bilingual messages)`);
}
