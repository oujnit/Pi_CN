import { t } from "../i18n/index.ts";
/**
 * CLI argument parsing and help display
 */

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import chalk from "chalk";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR, ENV_SESSION_DIR } from "../config.ts";
import type { ExtensionFlag } from "../core/extensions/types.ts";
import type { TuiMode } from "../core/settings-manager.ts";

export type Mode = "text" | "json" | "rpc";

export interface Args {
	language?: string;
	provider?: string;
	model?: string;
	apiKey?: string;
	systemPrompt?: string;
	appendSystemPrompt?: string[];
	thinking?: ThinkingLevel;
	continue?: boolean;
	resume?: boolean;
	help?: boolean;
	version?: boolean;
	mode?: Mode;
	name?: string;
	noSession?: boolean;
	session?: string;
	sessionId?: string;
	fork?: string;
	sessionDir?: string;
	models?: string[];
	tools?: string[];
	excludeTools?: string[];
	noTools?: boolean;
	noBuiltinTools?: boolean;
	extensions?: string[];
	noExtensions?: boolean;
	print?: boolean;
	export?: string;
	noSkills?: boolean;
	skills?: string[];
	promptTemplates?: string[];
	noPromptTemplates?: boolean;
	themes?: string[];
	useTheme?: string;
	noThemes?: boolean;
	noContextFiles?: boolean;
	listModels?: string | true;
	offline?: boolean;
	tuiMode?: TuiMode;
	verbose?: boolean;
	projectTrustOverride?: boolean;
	messages: string[];
	fileArgs: string[];
	/** Unknown flags (potentially extension flags) - map of flag name to value */
	unknownFlags: Map<string, boolean | string>;
	diagnostics: Array<{ type: "warning" | "error"; message: string }>;
}

const VALID_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export function isValidThinkingLevel(level: string): level is ThinkingLevel {
	return VALID_THINKING_LEVELS.includes(level as ThinkingLevel);
}

export function normalizeSessionName(value: string): string | undefined {
	const name = value.trim();
	return name.length > 0 ? name : undefined;
}

export function extractLanguageArgs(args: readonly string[]): { args: string[]; language: string | undefined } {
	const filtered: string[] = [];
	let language: string | undefined;
	for (let index = 0; index < args.length; index++) {
		const argument = args[index];
		if (argument === "--") {
			filtered.push(...args.slice(index));
			break;
		}
		if (argument.startsWith("--lang=")) {
			language = argument.slice("--lang=".length);
			continue;
		}
		if (argument === "--lang") {
			const value = args[index + 1];
			language = value === undefined || value.startsWith("-") ? "" : value;
			if (value !== undefined && !value.startsWith("-")) index++;
			continue;
		}
		filtered.push(argument);
	}
	return { args: filtered, language };
}

export function parseArgs(args: string[]): Args {
	const result: Args = {
		messages: [],
		fileArgs: [],
		unknownFlags: new Map(),
		diagnostics: [],
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--") {
			for (const positionalArg of args.slice(i + 1)) {
				if (positionalArg.startsWith("@")) {
					result.fileArgs.push(positionalArg.slice(1));
				} else {
					result.messages.push(positionalArg);
				}
			}
			break;
		} else if (arg === "--help" || arg === "-h") {
			result.help = true;
		} else if (arg === "--version" || arg === "-v") {
			result.version = true;
		} else if (arg === "--mode") {
			const mode = args[i + 1];
			if (mode === undefined || mode.startsWith("-")) {
				result.diagnostics.push({ type: "error", message: t("args.mode_requires_text_json_or_rpc") });
				continue;
			}
			i++;
			if (mode !== "text" && mode !== "json" && mode !== "rpc") {
				result.diagnostics.push({
					type: "error",
					message: t("args.invalid_mode_p_valid_values_text_json_rpc", { p0: mode }),
				});
				continue;
			}
			result.mode = mode;
		} else if (arg === "--continue" || arg === "-c") {
			result.continue = true;
		} else if (arg === "--resume" || arg === "-r") {
			result.resume = true;
		} else if (arg === "--lang" || arg.startsWith("--lang=")) {
			const value = arg.startsWith("--lang=") ? arg.slice(7) : args[++i];
			result.language = value ?? "";
		} else if (arg === "--provider" && i + 1 < args.length) {
			result.provider = args[++i];
		} else if (arg === "--model" && i + 1 < args.length) {
			result.model = args[++i];
		} else if (arg === "--api-key" && i + 1 < args.length) {
			result.apiKey = args[++i];
		} else if (arg === "--system-prompt" && i + 1 < args.length) {
			result.systemPrompt = args[++i];
		} else if (arg === "--append-system-prompt" && i + 1 < args.length) {
			result.appendSystemPrompt = result.appendSystemPrompt ?? [];
			result.appendSystemPrompt.push(args[++i]);
		} else if (arg === "--name" || arg === "-n") {
			if (i + 1 < args.length) {
				result.name = args[++i];
			} else {
				result.diagnostics.push({ type: "error", message: t("args.name_requires_a_value") });
			}
		} else if (arg === "--no-session") {
			result.noSession = true;
		} else if (arg === "--session" && i + 1 < args.length) {
			result.session = args[++i];
		} else if (arg === "--session-id" && i + 1 < args.length) {
			result.sessionId = args[++i];
		} else if (arg === "--fork" && i + 1 < args.length) {
			result.fork = args[++i];
		} else if (arg === "--session-dir" && i + 1 < args.length) {
			result.sessionDir = args[++i];
		} else if (arg === "--models" && i + 1 < args.length) {
			result.models = args[++i].split(",").map((s) => s.trim());
		} else if (arg === "--no-tools" || arg === "-nt") {
			result.noTools = true;
		} else if (arg === "--no-builtin-tools" || arg === "-nbt") {
			result.noBuiltinTools = true;
		} else if ((arg === "--tools" || arg === "-t") && i + 1 < args.length) {
			result.tools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if ((arg === "--exclude-tools" || arg === "-xt") && i + 1 < args.length) {
			result.excludeTools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if (arg === "--thinking" && i + 1 < args.length) {
			const level = args[++i];
			if (isValidThinkingLevel(level)) {
				result.thinking = level;
			} else {
				result.diagnostics.push({
					type: "warning",
					message: t("args.invalid_thinking_level_p_valid_values_p", {
						p0: level,
						p1: VALID_THINKING_LEVELS.join(", "),
					}),
				});
			}
		} else if (arg === "--print" || arg === "-p") {
			result.print = true;
			const next = args[i + 1];
			if (next !== undefined && !next.startsWith("@") && (!next.startsWith("-") || next.startsWith("---"))) {
				result.messages.push(next);
				i++;
			}
		} else if (arg === "--export" && i + 1 < args.length) {
			result.export = args[++i];
		} else if ((arg === "--extension" || arg === "-e") && i + 1 < args.length) {
			result.extensions = result.extensions ?? [];
			result.extensions.push(args[++i]);
		} else if (arg === "--no-extensions" || arg === "-ne") {
			result.noExtensions = true;
		} else if (arg === "--skill" && i + 1 < args.length) {
			result.skills = result.skills ?? [];
			result.skills.push(args[++i]);
		} else if (arg === "--prompt-template" && i + 1 < args.length) {
			result.promptTemplates = result.promptTemplates ?? [];
			result.promptTemplates.push(args[++i]);
		} else if (arg === "--theme" && i + 1 < args.length) {
			result.themes = result.themes ?? [];
			result.themes.push(args[++i]);
		} else if (arg === "--use-theme") {
			const themeName = args[i + 1];
			if (themeName === undefined || themeName.startsWith("-")) {
				result.diagnostics.push({ type: "error", message: t("args.use_theme_requires_a_theme_name") });
			} else {
				result.useTheme = themeName;
				i++;
			}
		} else if (arg === "--no-skills" || arg === "-ns") {
			result.noSkills = true;
		} else if (arg === "--no-prompt-templates" || arg === "-np") {
			result.noPromptTemplates = true;
		} else if (arg === "--no-themes") {
			result.noThemes = true;
		} else if (arg === "--no-context-files" || arg === "-nc") {
			result.noContextFiles = true;
		} else if (arg === "--list-models") {
			// Check if next arg is a search pattern (not a flag or file arg)
			if (i + 1 < args.length && !args[i + 1].startsWith("-") && !args[i + 1].startsWith("@")) {
				result.listModels = args[++i];
			} else {
				result.listModels = true;
			}
		} else if (arg === "--tui-mode") {
			const mode = args[i + 1];
			if (mode === "regular" || mode === "fullscreen") {
				result.tuiMode = mode;
				i++;
			} else if (mode === undefined || mode.startsWith("-")) {
				result.diagnostics.push({ type: "error", message: t("args.tui_mode_requires_regular_or_fullscreen") });
			} else {
				i++;
				result.diagnostics.push({
					type: "error",
					message: t("args.invalid_tui_mode_p_valid_values_regular", { p0: mode }),
				});
			}
		} else if (arg === "--verbose") {
			result.verbose = true;
		} else if (arg === "--approve" || arg === "-a") {
			result.projectTrustOverride = true;
		} else if (arg === "--no-approve" || arg === "-na") {
			result.projectTrustOverride = false;
		} else if (arg === "--offline") {
			result.offline = true;
		} else if (arg.startsWith("@")) {
			result.fileArgs.push(arg.slice(1)); // Remove @ prefix
		} else if (arg.startsWith("--")) {
			const eqIndex = arg.indexOf("=");
			if (eqIndex !== -1) {
				result.unknownFlags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
			} else {
				const flagName = arg.slice(2);
				const next = args[i + 1];
				if (next !== undefined && !next.startsWith("-") && !next.startsWith("@")) {
					result.unknownFlags.set(flagName, next);
					i++;
				} else {
					result.unknownFlags.set(flagName, true);
				}
			}
		} else if (arg.startsWith("-") && !arg.startsWith("--")) {
			result.diagnostics.push({ type: "error", message: t("args.unknown_option_p", { p0: arg }) });
		} else if (!arg.startsWith("-")) {
			result.messages.push(arg);
		}
	}

	return result;
}

export function printHelp(extensionFlags?: ExtensionFlag[]): void {
	const extensionFlagsText =
		extensionFlags && extensionFlags.length > 0
			? `
${chalk.bold(t("args.extension_cli_flags"))}
${extensionFlags
	.map((flag) => {
		const value = flag.type === "string" ? " <value>" : "";
		const description = flag.description ?? t("args.registered_by_p", { p0: String(flag.extensionPath) });
		return `  --${flag.name}${value}`.padEnd(30) + description;
	})
	.join("\n")}
`
			: "";
	console.log(
		t("args.p_ai_coding_assistant_with_read_bash", {
			p0: String(chalk.bold(APP_NAME)),
			p1: String(chalk.bold(t("args.usage"))),
			p2: String(APP_NAME),
			p3: String(chalk.bold(t("args.commands"))),
			p4: String(APP_NAME),
			p5: String(APP_NAME),
			p6: String(APP_NAME),
			p7: String(APP_NAME),
			p8: String(APP_NAME),
			p9: String(APP_NAME),
			p10: String(APP_NAME),
			p11: String(APP_NAME),
			p12: String(chalk.bold(t("args.options"))),
			p13: String(extensionFlagsText),
			p14: String(chalk.bold(t("args.examples"))),
			p15: String(APP_NAME),
			p16: String(APP_NAME),
			p17: String(APP_NAME),
			p18: String(APP_NAME),
			p19: String(APP_NAME),
			p20: String(APP_NAME),
			p21: String(APP_NAME),
			p22: String(APP_NAME),
			p23: String(APP_NAME),
			p24: String(APP_NAME),
			p25: String(APP_NAME),
			p26: String(APP_NAME),
			p27: String(APP_NAME),
			p28: String(APP_NAME),
			p29: String(APP_NAME),
			p30: String(APP_NAME),
			p31: String(APP_NAME),
			p32: String(APP_NAME),
			p33: String(APP_NAME),
			p34: String(APP_NAME),
			p35: String(CONFIG_DIR_NAME),
			p36: String(APP_NAME),
			p37: String(chalk.bold(t("args.environment_variables"))),
			p38: String(ENV_AGENT_DIR.padEnd(32)),
			p39: String(CONFIG_DIR_NAME),
			p40: String(ENV_SESSION_DIR.padEnd(32)),
			p41: String(chalk.bold(t("args.built_in_tool_names"))),
		}),
	);
}
