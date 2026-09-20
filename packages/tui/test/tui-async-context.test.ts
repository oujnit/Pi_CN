import assert from "node:assert";
import { AsyncLocalStorage } from "node:async_hooks";
import { describe, it } from "node:test";
import type { Component, TUI } from "../src/tui.ts";
import { TuiMainScreen } from "../src/tui-main-screen.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

class ContextRecorder implements Component {
	readonly contexts: Array<string | undefined> = [];
	private readonly storage: AsyncLocalStorage<string>;

	constructor(storage: AsyncLocalStorage<string>) {
		this.storage = storage;
	}

	render(): string[] {
		return [""];
	}

	handleInput(): void {
		this.contexts.push(this.storage.getStore());
	}

	invalidate(): void {}
}

describe("TUI async context", () => {
	it("preserves the context active when terminal callbacks are registered", () => {
		const storage = new AsyncLocalStorage<string>();
		const terminal = new VirtualTerminal(80, 24);
		const tui: TUI = new TuiMainScreen(terminal);
		const recorder = new ContextRecorder(storage);
		tui.setFocus(recorder);

		storage.run("cli-instance", () => tui.start());
		terminal.sendInput("x");

		assert.deepStrictEqual(recorder.contexts, ["cli-instance"]);
		tui.stop();
	});
});
