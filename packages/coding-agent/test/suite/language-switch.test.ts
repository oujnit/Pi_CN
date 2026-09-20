import type { AgentTool } from "@earendil-works/pi-agent-core";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageContext, t } from "../../src/i18n/index.ts";
import { createHarness, type Harness } from "./harness.ts";

describe("live language switching", () => {
	let harness: Harness | undefined;
	afterEach(() => harness?.cleanup());

	it("does not repeat provider requests or tools while streaming and retrying", async () => {
		const language = new LanguageContext("zh-CN");
		const renderedLabels: string[] = [];
		language.subscribe(() => renderedLabels.push(language.run(() => t("interactive_mode.working"))));
		let toolRuns = 0;
		const tool: AgentTool = {
			name: "switch-language",
			label: "Switch language",
			description: "Switch the UI language during a tool call",
			parameters: Type.Object({}),
			execute: async () => {
				toolRuns++;
				language.setLanguage("zh-CN");
				return { content: [{ type: "text", text: "raw tool result" }], details: {} };
			},
		};
		harness = await createHarness({
			tools: [tool],
			settings: { retry: { enabled: true, maxRetries: 2, baseDelayMs: 1 } },
		});
		harness.setResponses([
			fauxAssistantMessage("", { stopReason: "error", errorMessage: "overloaded_error" }),
			fauxAssistantMessage(fauxToolCall("switch-language", {}), { stopReason: "toolUse" }),
			fauxAssistantMessage("final answer"),
		]);
		const unsubscribe = harness.session.subscribe((event) => {
			if (event.type === "auto_retry_start") language.setLanguage("en");
		});

		await language.run(() => harness!.session.prompt("test"));
		unsubscribe();

		expect(harness.faux.state.callCount).toBe(3);
		expect(toolRuns).toBe(1);
		expect(renderedLabels).toEqual(["Working", "处理中"]);
		const toolResult = harness.session.messages.find((message) => message.role === "toolResult");
		expect(JSON.stringify(toolResult)).toContain("raw tool result");
	});
});
