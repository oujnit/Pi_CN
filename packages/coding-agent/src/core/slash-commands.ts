import { APP_NAME } from "../config.ts";
import { t } from "../i18n/index.ts";
import type { SourceInfo } from "./source-info.ts";

export type SlashCommandSource = "extension" | "prompt" | "skill";

export interface SlashCommandInfo {
	name: string;
	description?: string;
	source: SlashCommandSource;
	sourceInfo: SourceInfo;
}

export interface BuiltinSlashCommand {
	name: string;
	description: string;
	argumentHint?: string;
}

export const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [
	{
		name: "settings",
		get description() {
			return t("slash_commands.open_settings_menu");
		},
	},
	{
		name: "model",
		get description() {
			return t("slash_commands.select_model_opens_selector_ui");
		},
		argumentHint: "<provider/model>",
	},
	{
		name: "tree",
		get description() {
			return t("slash_commands.navigate_session_tree_switch_branches");
		},
	},
	{
		name: "thinking",
		get description() {
			return t("slash_commands.set_thinking_level");
		},
		argumentHint: "<level>",
	},
	{
		name: "scoped-models",
		get description() {
			return t("slash_commands.enable_disable_models_for_ctrl_p_cycling");
		},
	},
	{
		name: "export",
		get description() {
			return t("slash_commands.export_session_html_default_or_specify_path");
		},
	},
	{
		name: "import",
		get description() {
			return t("slash_commands.import_and_resume_a_session_from_a");
		},
	},
	{
		name: "share",
		get description() {
			return t("slash_commands.share_session_as_a_secret_github_gist");
		},
	},
	{
		name: "bug",
		get description() {
			return t("slash_commands.report_a_bug_to_the_pi_developers");
		},
		argumentHint: "<description>",
	},
	{
		name: "copy",
		get description() {
			return t("slash_commands.copy_last_agent_message_to_clipboard");
		},
	},
	{
		name: "name",
		get description() {
			return t("slash_commands.set_session_display_name");
		},
	},
	{
		name: "session",
		get description() {
			return t("slash_commands.show_session_info_and_stats");
		},
	},
	{
		name: "changelog",
		get description() {
			return t("slash_commands.show_changelog_entries");
		},
	},
	{
		name: "hotkeys",
		get description() {
			return t("slash_commands.show_all_keyboard_shortcuts");
		},
	},
	{
		name: "fork",
		get description() {
			return t("slash_commands.create_a_new_fork_from_a_previous");
		},
	},
	{
		name: "clone",
		get description() {
			return t("slash_commands.duplicate_the_current_session_at_the_current");
		},
	},
	{
		name: "trust",
		get description() {
			return t("slash_commands.save_project_trust_decision_for_future_sessions");
		},
	},
	{
		name: "login",
		get description() {
			return t("slash_commands.configure_provider_authentication");
		},
		argumentHint: "<provider>",
	},
	{
		name: "logout",
		get description() {
			return t("slash_commands.remove_provider_authentication");
		},
	},
	{
		name: "new",
		get description() {
			return t("slash_commands.start_a_new_session");
		},
	},
	{
		name: "compact",
		get description() {
			return t("slash_commands.manually_compact_the_session_context");
		},
	},
	{
		name: "resume",
		get description() {
			return t("slash_commands.resume_a_different_session");
		},
	},
	{
		name: "reload",
		get description() {
			return t("slash_commands.reload_keybindings_extensions_skills_prompts_themes_and");
		},
	},
	{
		name: "quit",
		get description() {
			return t("slash_commands.quit_p", { p0: String(APP_NAME) });
		},
	},
];
