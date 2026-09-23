import { describe, expect, it, vi } from "vitest";
import { LanguageContext, resolveLanguage, t } from "../src/i18n/index.ts";

describe("language context", () => {
	it("uses CLI, environment, saved setting, then Chinese in that order", () => {
		expect(resolveLanguage("en", "zh-CN", "zh-CN").language).toBe("en");
		expect(resolveLanguage(undefined, "en", "zh-CN").language).toBe("en");
		expect(resolveLanguage(undefined, undefined, "en").language).toBe("en");
		expect(resolveLanguage(undefined, undefined, undefined).language).toBe("zh-CN");
	});

	it("rejects an invalid CLI value and falls through invalid lower-priority values", () => {
		expect(() => resolveLanguage("fr", undefined, undefined)).toThrow(/Invalid --lang value/);
		expect(resolveLanguage(undefined, "fr", "en")).toEqual({
			language: "en",
			warnings: ["Invalid PI_LANG: fr. Use zh-CN or en."],
		});
	});

	it("switches immediately and notifies only its own CLI context", () => {
		const first = new LanguageContext("zh-CN");
		const second = new LanguageContext("en");
		const listener = vi.fn();
		first.subscribe(listener);

		expect(first.run(() => t("settings.enabled"))).toBe("开启");
		expect(second.run(() => t("settings.enabled"))).toBe("On");
		first.setLanguage("en");
		expect(listener).toHaveBeenCalledOnce();
		expect(first.run(() => t("settings.enabled"))).toBe("On");
		expect(second.run(() => t("settings.enabled"))).toBe("On");
	});
});
