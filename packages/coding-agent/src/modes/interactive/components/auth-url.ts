import { Container, hyperlink, Text, type TUI } from "@earendil-works/pi-tui";
import { t } from "../../../i18n/index.ts";
import { copyToClipboard } from "../../../utils/clipboard.ts";
import { theme } from "../theme/theme.ts";
import { keyHint } from "./keybinding-hints.ts";

/**
 * A sign-in URL with a click hint and a copy hint. Hosts call `copy()` when `app.message.copy` is
 * pressed, since a long URL wraps and often cannot be selected or clicked as a whole (SSH, tmux).
 */
export class AuthUrlComponent extends Container {
	readonly url: string;
	private readonly tui: TUI;
	private readonly hint: Text;

	constructor(tui: TUI, url: string) {
		super();
		this.tui = tui;
		this.url = url;
		this.addChild(new Text(theme.fg("accent", hyperlink(url, url)), 1, 0));
		this.hint = new Text("", 1, 0);
		this.addChild(this.hint);
		this.setHint(keyHint("app.message.copy", t("login_dialog.to_copy")));
	}

	private setHint(suffix: string): void {
		const clickHint =
			process.platform === "darwin" ? t("login_dialog.cmd_click_to_open") : t("login_dialog.ctrl_click_to_open");
		this.hint.setText(`${theme.fg("dim", hyperlink(clickHint, this.url))} ${theme.fg("dim", "•")} ${suffix}`);
		this.tui.requestRender();
	}

	async copy(): Promise<void> {
		try {
			await copyToClipboard(this.url);
			this.setHint(theme.fg("success", t("login_dialog.copied_url_to_clipboard")));
		} catch (error) {
			this.setHint(theme.fg("error", error instanceof Error ? error.message : String(error)));
		}
	}
}
