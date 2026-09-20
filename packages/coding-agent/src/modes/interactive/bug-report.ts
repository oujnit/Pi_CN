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
import { getRadiusGatewayUrl, RADIUS_PROVIDER_ID } from "../../core/radius.ts";
import { serializeSessionBranch } from "../../core/session-export.ts";
import { BorderedLoader } from "./components/bordered-loader.ts";
import { ExtensionInputComponent } from "./components/extension-input.ts";
import { ExtensionSelectorComponent } from "./components/extension-selector.ts";
import { createShareTrailingEntries } from "./session-share.ts";
import { theme } from "./theme/theme.ts";

interface BugReportContext {
	session: AgentSession;
	ui: TUI;
	editorContainer: Container;
	editor: EditorComponent;
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

const DISCLAIMER =
	"该报告将发送给 Pi 开发者（Earendil），不会公开分享。内容包括：你的 pi 版本、操作系统、当前模型与供应商配置（不含 API key）、已加载的扩展、各项设置，以及本次会话中的供应商错误诊断信息。";
const TRANSCRIPT_NOTE =
	"会话记录包含你的消息、模型输出、工具调用及其结果，包括本次会话中读取到的文件内容和命令输出。";

/** Run the `/bug` flow: consent, optional summary, then upload or export. */
export async function reportBug(context: BugReportContext, initialHint?: string): Promise<void> {
	const options = await promptForOptions(context, initialHint);
	if (!options) {
		context.showStatus("bug 报告已取消");
		return;
	}

	let summary: string | undefined;
	if (options.includeSummary) {
		const loader = showLoader(
			context,
			`正在使用 ${context.session.model?.name ?? "当前模型"} 生成摘要...`,
		);
		try {
			summary = await context.session.summarizeForBugReport({ hint: options.hint, signal: loader.signal });
		} catch (error: unknown) {
			restoreEditor(context, loader);
			if (loader.signal.aborted) context.showStatus("bug 报告已取消");
			else context.showError(`生成 bug 报告摘要失败：${errorMessage(error)}`);
			return;
		}
		restoreEditor(context, loader);
		if (loader.signal.aborted) {
			context.showStatus("bug 报告已取消");
			return;
		}
	}

	let bundle: BugReportBundle;
	try {
		bundle = buildBundle(context.session, options, summary);
	} catch (error: unknown) {
		context.showError(`构建 bug 报告失败：${errorMessage(error)}`);
		return;
	}

	if (options.delivery === "upload") {
		const failure = await upload(context, bundle);
		if (failure === undefined) return;
		const fallback = await choose(
			context,
			"上传失败",
			["导出为 Zip", "取消"],
			`${failure}\n\n改为将报告导出为 zip 压缩包？`,
		);
		if (fallback !== "导出为 Zip") {
			context.showStatus("bug 报告已取消");
			return;
		}
	}
	await exportZip(context, bundle);
}

async function promptForOptions(
	context: BugReportContext,
	initialHint: string | undefined,
): Promise<BugReportOptions | undefined> {
	const hint = await input(context, "报告 bug", `${DISCLAIMER}\n\n出了什么问题？（可选）`, initialHint);
	if (hint === null) return undefined;
	const transcript = await choose(
		context,
		"是否包含会话记录？",
		["是，包含会话记录", "否"],
		TRANSCRIPT_NOTE,
	);
	if (!transcript) return undefined;
	const includeSession = transcript !== "否";
	let includeSummary = false;
	if (!includeSession) {
		const model = context.session.model;
		const summary = await choose(
			context,
			`改为附上由 ${model?.name ?? "当前模型"} 生成的摘要？`,
			["是，生成摘要", "否"],
			`会话记录将连同你的凭据和 token 一起发送给 ${model?.provider ?? "你的供应商"}。仅附上生成的摘要，会话记录仍保留在你的机器上。`,
		);
		if (!summary) return undefined;
		includeSummary = summary !== "否";
	}
	const description = hint.trim();
	const delivery = await choose(
		context,
		"bug 报告",
		["上传报告", "导出为 Zip", "取消"],
		`描述：${description || "无"}\n会话记录：${includeSession ? "包含" : "不包含"}\n摘要：${includeSummary ? `由 ${context.session.model?.name ?? "当前模型"} 生成` : "无"}\n\n上传会把报告发送到 ${new URL(getRadiusGatewayUrl()).host}。导出则会在当前目录写入一个 zip 压缩包。`,
	);
	if (!delivery || delivery === "取消") return undefined;
	return {
		hint: description || undefined,
		includeSession,
		includeSummary,
		delivery: delivery === "上传报告" ? "upload" : "zip",
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
	const loader = showLoader(context, "正在上传 bug 报告...");
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
		context.showStatus(`bug 报告已上传。报告 ID：${result.id}`);
		return undefined;
	} catch (error: unknown) {
		restoreEditor(context, loader);
		if (loader.signal.aborted) {
			context.showStatus("bug 报告已取消");
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
		context.showError(`写入 bug 报告失败：${errorMessage(error)}`);
		return;
	}
	recordInSession(context.session, bundle, { delivery: "zip", path: archivePath });
	context.showStatus(`bug 报告已导出到：${archivePath}\n报告 ID：${bundle.metadata.id}`);
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
		let component: ExtensionInputComponent;
		const finish = (value: string | null) => {
			restoreEditor(context, component);
			resolve(value);
		};
		component = new ExtensionInputComponent(
			title,
			undefined,
			(value) => finish(value),
			() => finish(null),
			{
				initialValue,
				description,
			},
		);
		showOverlay(context, component);
	});
}

function choose(
	context: BugReportContext,
	title: string,
	options: string[],
	description?: string,
): Promise<string | undefined> {
	return new Promise((resolve) => {
		let component: ExtensionSelectorComponent;
		const finish = (value?: string) => {
			restoreEditor(context, component);
			resolve(value);
		};
		component = new ExtensionSelectorComponent(title, options, finish, () => finish(), {
			tui: context.ui,
			description,
		});
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
	return error instanceof Error ? error.message : "未知错误";
}
