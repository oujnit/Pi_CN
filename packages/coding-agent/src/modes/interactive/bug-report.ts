import * as path from "node:path";
import type { Container, EditorComponent, TUI } from "@earendil-works/pi-tui";
import { getAuthCredential } from "../../cli/auth-command.ts";
import type { AgentSession } from "../../core/agent-session.ts";
import {
	BUG_REPORT_CUSTOM_ENTRY_TYPE,
	type BugReportBundle,
	type BugReportSessionEntryData,
	bugReportArchiveFileName,
	collectBugReportDiagnostics,
	collectBugReportMetadata,
	writeBugReportArchive,
} from "../../core/bug-report.ts";
import { uploadBugReport } from "../../core/bug-report-upload.ts";
import { clearCrashLog, readCrashLog } from "../../core/crash-log.ts";
import type { KeybindingsManager } from "../../core/keybindings.ts";
import { getRadiusGatewayUrl, RADIUS_PROVIDER_ID } from "../../core/radius.ts";
import { serializeSessionBranch } from "../../core/session-export.ts";
import { t } from "../../i18n/index.ts";
import { BorderedLoader } from "./components/bordered-loader.ts";
import { ExtensionEditorComponent } from "./components/extension-editor.ts";
import { ExtensionSelectorComponent } from "./components/extension-selector.ts";
import { createShareTrailingEntries } from "./session-share.ts";
import { theme } from "./theme/theme.ts";

interface BugReportContext {
	session: AgentSession;
	ui: TUI;
	editorContainer: Container;
	editor: EditorComponent;
	keybindings: KeybindingsManager;
	showStatus: (message: string) => void;
	showError: (message: string) => void;
}

interface BugReportOptions {
	hint?: string;
	includeSession: boolean;
	includeSummary: boolean;
	delivery: "upload" | "zip";
}

type Overlay = Container & { dispose?: () => void };

interface Choice<Value extends string> {
	value: Value;
	label: string;
}

/** Run the `/bug` flow: consent, optional summary, then upload or export. */
export async function reportBug(context: BugReportContext, initialHint?: string): Promise<void> {
	const options = await promptForOptions(context, initialHint);
	if (!options) {
		context.showStatus(t("bug_report.bug_report_cancelled"));
		return;
	}
	if (options.delivery === "upload" && process.env.PI_OFFLINE) {
		context.showError(t("bug_report.uploading_bug_reports_requires_online_mode"));
		return;
	}

	let summary: string | undefined;
	if (options.includeSummary) {
		const loader = showLoader(
			context,
			t("bug_report.writing_summary_with_p", {
				p0: String(context.session.model?.name ?? t("bug_report.the_current_model")),
			}),
		);
		try {
			summary = await context.session.summarizeForBugReport({ hint: options.hint, signal: loader.signal });
		} catch (error: unknown) {
			restoreEditor(context, loader);
			if (loader.signal.aborted) context.showStatus(t("bug_report.bug_report_cancelled"));
			else
				context.showError(
					t("bug_report.failed_to_write_bug_report_summary_p", { p0: String(errorMessage(error)) }),
				);
			return;
		}
		restoreEditor(context, loader);
		if (loader.signal.aborted) {
			context.showStatus(t("bug_report.bug_report_cancelled"));
			return;
		}
	}

	let bundle: BugReportBundle;
	try {
		bundle = buildBundle(context.session, options, summary);
	} catch (error: unknown) {
		context.showError(t("bug_report.failed_to_build_bug_report_p", { p0: String(errorMessage(error)) }));
		return;
	}

	if (options.delivery === "upload") {
		const failure = await upload(context, bundle);
		if (failure === undefined) return;
		const fallback = await choose(
			context,
			t("bug_report.upload_failed"),
			[
				{ value: "export", label: t("bug_report.export_as_zip") },
				{ value: "cancel", label: t("bug_report.cancel") },
			],
			t("bug_report.p_export_the_report_as_a_zip", { p0: String(failure) }),
		);
		if (fallback !== "export") {
			context.showStatus(t("bug_report.bug_report_cancelled"));
			return;
		}
	}
	await exportZip(context, bundle);
}

async function promptForOptions(
	context: BugReportContext,
	initialHint: string | undefined,
): Promise<BugReportOptions | undefined> {
	const hint = await input(
		context,
		t("bug_report.report_a_bug"),
		t("bug_report.p_what_went_wrong_optional", {
			p0: String(t("bug_report.this_report_goes_to_the_pi_developers")),
		}),
		initialHint,
	);
	if (hint === null) return undefined;
	const transcript = await choose(
		context,
		t("bug_report.include_the_session_transcript"),
		[
			{ value: "include", label: t("bug_report.yes_include_the_transcript") },
			{ value: "exclude", label: t("bug_report.no") },
		],
		t("bug_report.the_transcript_contains_your_messages_model_output"),
	);
	if (!transcript) return undefined;
	const includeSession = transcript === "include";
	let includeSummary = false;
	if (!includeSession) {
		const model = context.session.model;
		const summary = await choose(
			context,
			t("bug_report.attach_a_summary_written_by_p_instead", {
				p0: String(model?.name ?? t("bug_report.the_current_model")),
			}),
			[
				{ value: "generate", label: t("bug_report.yes_generate_a_summary") },
				{ value: "skip", label: t("bug_report.no") },
			],
			t("bug_report.the_transcript_is_sent_to_p_with", {
				p0: String(model?.provider ?? t("bug_report.your_provider")),
			}),
		);
		if (!summary) return undefined;
		includeSummary = summary === "generate";
	}
	const description = hint.trim();
	const delivery = await choose(
		context,
		t("bug_report.bug_report"),
		[
			{ value: "upload", label: t("bug_report.upload_report") },
			{ value: "zip", label: t("bug_report.export_as_zip") },
			{ value: "cancel", label: t("bug_report.cancel") },
		],
		t("bug_report.description_p_transcript_p_summary_p_upload", {
			p0: String(description || t("bug_report.none")),
			p1: String(includeSession ? t("bug_report.included") : t("bug_report.not_included")),
			p2: String(
				includeSummary
					? t("bug_report.written_by_p", {
							p0: String(context.session.model?.name ?? t("bug_report.the_current_model")),
						})
					: t("bug_report.none"),
			),
			p3: String(new URL(getRadiusGatewayUrl()).host),
		}),
	);
	if (!delivery || delivery === "cancel") return undefined;
	return {
		hint: description || undefined,
		includeSession,
		includeSummary,
		delivery,
	};
}

function buildBundle(session: AgentSession, options: BugReportOptions, summary: string | undefined): BugReportBundle {
	const extensions = session.resourceLoader.getExtensions();
	return {
		metadata: collectBugReportMetadata({
			hint: options.hint,
			sessionId: session.sessionId,
			cwd: session.sessionManager.getCwd(),
			includeSession: options.includeSession,
			includeSummary: summary !== undefined,
			messageCount: session.messages.length,
			model: session.model,
			modelRuntime: session.modelRuntime,
			thinkingLevel: session.thinkingLevel,
			extensions: extensions.extensions,
			extensionErrors: extensions.errors,
			globalSettings: session.settingsManager.getGlobalSettings(),
			projectSettings: session.settingsManager.getProjectSettings(),
		}),
		diagnostics: collectBugReportDiagnostics(session.sessionManager, readCrashLog()),
		summary,
		sessionJsonl: options.includeSession
			? serializeSessionBranch(session.sessionManager, (parentId, timestamp) =>
					createShareTrailingEntries(session, parentId, timestamp),
				)
			: undefined,
	};
}

async function upload(context: BugReportContext, bundle: BugReportBundle): Promise<string | undefined> {
	const loader = showLoader(context, t("bug_report.uploading_bug_report"));
	try {
		const provider = context.session.modelRuntime.getProvider(RADIUS_PROVIDER_ID);
		const token = provider
			? getAuthCredential(
					await context.session.modelRuntime.getAuth(RADIUS_PROVIDER_ID, { minOAuthValidityMs: 5 * 60_000 }),
				)
			: undefined;
		const result = await uploadBugReport(bundle, { token, signal: loader.signal });
		restoreEditor(context, loader);
		recordInSession(context.session, bundle, { delivery: "upload" });
		context.showStatus(t("bug_report.bug_report_uploaded_report_id_p", { p0: String(result.id) }));
		return undefined;
	} catch (error: unknown) {
		restoreEditor(context, loader);
		if (loader.signal.aborted) {
			context.showStatus(t("bug_report.bug_report_cancelled"));
			return undefined;
		}
		return errorMessage(error);
	}
}

async function exportZip(context: BugReportContext, bundle: BugReportBundle): Promise<void> {
	const archivePath = path.join(process.cwd(), bugReportArchiveFileName(bundle.metadata.id));
	try {
		await writeBugReportArchive(bundle, archivePath);
	} catch (error: unknown) {
		context.showError(t("bug_report.failed_to_write_bug_report_p", { p0: String(errorMessage(error)) }));
		return;
	}
	recordInSession(context.session, bundle, { delivery: "zip", path: archivePath });
	context.showStatus(
		t("bug_report.bug_report_exported_to_p_report_id", { p0: String(archivePath), p1: String(bundle.metadata.id) }),
	);
}

function recordInSession(
	session: AgentSession,
	bundle: BugReportBundle,
	delivery: Pick<BugReportSessionEntryData, "delivery" | "path">,
): void {
	session.sessionManager.appendCustomEntry(BUG_REPORT_CUSTOM_ENTRY_TYPE, {
		id: bundle.metadata.id,
		createdAt: bundle.metadata.createdAt,
		hint: bundle.metadata.hint,
		sessionIncluded: bundle.metadata.session.included,
		summaryIncluded: bundle.metadata.session.summaryIncluded,
		...delivery,
	} satisfies BugReportSessionEntryData);
	if (bundle.diagnostics.crashes.length > 0) clearCrashLog();
}

function input(
	context: BugReportContext,
	title: string,
	description: string,
	initialValue?: string,
): Promise<string | null> {
	return new Promise((resolve) => {
		let component: ExtensionEditorComponent;
		const finish = (value: string | null) => {
			restoreEditor(context, component);
			resolve(value);
		};
		component = new ExtensionEditorComponent(
			context.ui,
			context.keybindings,
			title,
			initialValue,
			(value) => finish(value),
			() => finish(null),
			{ description },
			context.session.settingsManager.getExternalEditorCommand(),
		);
		showOverlay(context, component);
	});
}

function choose<Value extends string>(
	context: BugReportContext,
	title: string,
	options: readonly Choice<Value>[],
	description?: string,
): Promise<Value | undefined> {
	return new Promise((resolve) => {
		let component: ExtensionSelectorComponent;
		const finish = (label?: string) => {
			restoreEditor(context, component);
			resolve(options.find((option) => option.label === label)?.value);
		};
		component = new ExtensionSelectorComponent(
			title,
			options.map((option) => option.label),
			finish,
			() => finish(),
			{
				tui: context.ui,
				description,
			},
		);
		showOverlay(context, component);
	});
}

function showLoader(context: BugReportContext, message: string): BorderedLoader {
	const loader = new BorderedLoader(context.ui, theme, message);
	showOverlay(context, loader);
	return loader;
}

function showOverlay(context: BugReportContext, component: Overlay): void {
	context.editorContainer.clear();
	context.editorContainer.addChild(component);
	context.ui.setFocus(component);
	context.ui.requestRender();
}

function restoreEditor(context: BugReportContext, component: Overlay): void {
	component.dispose?.();
	context.editorContainer.clear();
	context.editorContainer.addChild(context.editor);
	context.ui.setFocus(context.editor);
	context.ui.requestRender();
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : t("bug_report.unknown_error");
}
