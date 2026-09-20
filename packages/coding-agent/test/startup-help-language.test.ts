import { setKeybindings } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { LanguageContext } from "../src/i18n/index.ts";
import { buildStartupHelp } from "../src/modes/interactive/interactive-mode.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

function stripAnsi(value: string): string {
	return value.replace(/\u001b\[[0-9;]*m/g, "");
}

describe("startup help language", () => {
	beforeAll(() => {
		initTheme("dark");
		setKeybindings(new KeybindingsManager());
	});

	test("rebuilds compact and expanded help from the current language", () => {
		const language = new LanguageContext("zh-CN");

		language.run(() => {
			expect(stripAnsi(buildStartupHelp(false))).toContain("查看完整启动帮助和已加载资源");
			expect(stripAnsi(buildStartupHelp(true))).toContain("删除至行尾");
		});

		language.setLanguage("en");
		language.run(() => {
			expect(stripAnsi(buildStartupHelp(false))).toContain("show full startup help and loaded resources");
			expect(stripAnsi(buildStartupHelp(true))).toContain("delete to end");
		});
	});
});
