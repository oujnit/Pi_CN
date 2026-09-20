import { AsyncLocalStorage } from "node:async_hooks";
import { messages as en } from "./en.ts";
import { messages as zh } from "./zh-CN.ts";

export type Language = "zh-CN" | "en";
export type MessageKey = keyof typeof en;
type Slots<S extends string> = S extends `${string}{p${infer N}}${infer Rest}` ? `p${N}` | Slots<Rest> : never;
type Arguments<K extends MessageKey> = [Slots<(typeof en)[K]>] extends [never]
	? []
	: [params: Record<Slots<(typeof en)[K]>, string | number>];

const storage = new AsyncLocalStorage<LanguageContext>();

/** One context per CLI invocation; libraries keep upstream English by default. */
export class LanguageContext {
	language: Language;
	private readonly listeners = new Set<() => void>();
	constructor(language: Language = "zh-CN") {
		this.language = language;
	}
	run<T>(operation: () => T): T {
		return storage.run(this, operation);
	}
	bind<A extends unknown[], R>(operation: (...args: A) => R): (...args: A) => R {
		return (...args) => this.run(() => operation(...args));
	}
	setLanguage(language: Language): void {
		if (language === this.language) return;
		this.language = language;
		this.run(() => {
			for (const listener of this.listeners) listener();
		});
	}
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

export function getLanguageContext(): LanguageContext | undefined {
	return storage.getStore();
}

export function isLanguage(value: unknown): value is Language {
	return value === "zh-CN" || value === "en";
}

export function resolveLanguage(
	cli: unknown,
	environment: unknown,
	saved: unknown,
): { language: Language; warnings: string[] } {
	const warnings: string[] = [];
	if (cli !== undefined) {
		if (!isLanguage(cli)) throw new Error(`Invalid --lang value: ${String(cli)}. Use zh-CN or en.`);
		return { language: cli, warnings };
	}
	for (const [source, value] of [
		["PI_LANG", environment],
		["settings.language", saved],
	] as const) {
		if (value === undefined || value === "") continue;
		if (isLanguage(value)) return { language: value, warnings };
		warnings.push(`Invalid ${source}: ${String(value)}. Use zh-CN or en.`);
	}
	return { language: "zh-CN", warnings };
}

export function t<K extends MessageKey>(key: K, ...args: Arguments<K>): string {
	const messages: Record<MessageKey, string> = storage.getStore()?.language === "zh-CN" ? zh : en;
	const params = args[0] as Record<string, string | number> | undefined;
	return messages[key].replace(/\{(p\d+)\}/g, (placeholder, name: string) => String(params?.[name] ?? placeholder));
}

/** Capture this invocation when a component is rendered from a terminal callback. */
export function localizedText(render: () => string): () => string {
	const context = storage.getStore();
	return context ? context.bind(render) : render;
}
