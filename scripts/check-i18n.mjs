import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
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

for (const file of files) {
	const source = readFileSync(file, "utf8");
	const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const visit = (node) => {
		if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /[\u3400-\u9fff]/u.test(node.text)) {
			const isDefaultSearchAlias =
				file.endsWith("model-selector.ts") && (node.text === "默认" || node.text === " default 默认");
			if (!isDefaultSearchAlias) {
				const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
				errors.push(
					`${relative(root, file)}:${position.line + 1} contains hard-coded Chinese UI text outside the message table`,
				);
			}
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
}

if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(`i18n checks passed (${enKeys.length} bilingual messages)`);
}
