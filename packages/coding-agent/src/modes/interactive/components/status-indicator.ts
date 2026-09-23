import { type Component, Loader, type TUI, truncateToWidth } from "@earendil-works/pi-tui";
import type { WorkingIndicatorOptions } from "../../../core/extensions/index.ts";
import { t } from "../../../i18n/index.ts";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { keyText } from "./keybinding-hints.ts";

export type StatusIndicatorKind = "working" | "retry" | "compaction" | "branchSummary";

export class StatusIndicator extends Loader {
	readonly kind: StatusIndicatorKind;

	constructor(
		kind: StatusIndicatorKind,
		ui: TUI,
		spinnerColorFn: (str: string) => string,
		messageColorFn: (str: string) => string,
		message: string | (() => string),
		indicator?: WorkingIndicatorOptions,
	) {
		super(ui, spinnerColorFn, messageColorFn, message, indicator);
		this.kind = kind;
	}

	renderInBorder(width: number): string {
		const line = super.render(width + 2)[1] ?? "";
		return truncateToWidth(line.startsWith(" ") ? line.slice(1).trimEnd() : line.trimEnd(), width, "");
	}

	renderSpinnerInBorder(width: number): string {
		return truncateToWidth(this.getRenderedIndicator(), width, "");
	}

	dispose(): void {
		this.stop();
	}
}

export class WorkingStatusIndicator extends StatusIndicator {
	constructor(
		ui: TUI,
		message: string | (() => string),
		indicator?: WorkingIndicatorOptions,
		colorFn?: (text: string) => string,
	) {
		super(
			"working",
			ui,
			colorFn ?? ((text) => theme.fg("accent", text)),
			colorFn ?? ((text) => theme.fg("muted", text)),
			message,
			indicator,
		);
	}
}

export class RetryStatusIndicator extends StatusIndicator {
	private countdown: CountdownTimer | undefined;

	constructor(ui: TUI, attempt: number, maxAttempts: number, delayMs: number) {
		let secondsRemaining = Math.ceil(delayMs / 1000);
		const retryMessage = (seconds: number) =>
			t("status_indicator.retrying_p_p_in_p_s_p", {
				p0: String(attempt),
				p1: String(maxAttempts),
				p2: String(seconds),
				p3: String(keyText("app.interrupt")),
			});
		super(
			"retry",
			ui,
			(spinner) => theme.fg("warning", spinner),
			(text) => theme.fg("muted", text),
			() => retryMessage(secondsRemaining),
		);
		this.countdown = new CountdownTimer(
			delayMs,
			ui,
			(seconds) => {
				secondsRemaining = seconds;
				this.setMessage(() => retryMessage(secondsRemaining));
			},
			() => {
				this.countdown = undefined;
			},
		);
	}

	override dispose(): void {
		this.countdown?.dispose();
		this.countdown = undefined;
		super.dispose();
	}
}

export type CompactionStatusReason = "manual" | "threshold" | "overflow";

export class CompactionStatusIndicator extends StatusIndicator {
	constructor(ui: TUI, reason: CompactionStatusReason) {
		const label = () => {
			const cancelHint = t("status_indicator.p_to_cancel", { p0: String(keyText("app.interrupt")) });
			return reason === "manual"
				? t("status_indicator.compacting_context_p", { p0: String(cancelHint) })
				: t("status_indicator.p_auto_compacting_p", {
						p0: String(reason === "overflow" ? t("status_indicator.context_overflow_detected") : ""),
						p1: String(cancelHint),
					});
		};
		super(
			"compaction",
			ui,
			(spinner) => theme.fg("accent", spinner),
			(text) => theme.fg("muted", text),
			label,
		);
	}
}

export class BranchSummaryStatusIndicator extends StatusIndicator {
	constructor(ui: TUI) {
		super(
			"branchSummary",
			ui,
			(spinner) => theme.fg("accent", spinner),
			(text) => theme.fg("muted", text),
			() => t("status_indicator.summarizing_branch_p_to_cancel", { p0: String(keyText("app.interrupt")) }),
		);
	}
}

export class IdleStatus implements Component {
	invalidate(): void {
		// No cached state to invalidate.
	}

	render(width: number): string[] {
		const emptyLine = " ".repeat(width);
		return [emptyLine, emptyLine];
	}
}
