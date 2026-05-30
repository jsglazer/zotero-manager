import { App } from 'obsidian';

export function getVaultRoot(app: App): string {
	return (app.vault.adapter as any).getBasePath();
}

export function padNumber(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

export function getCurrentWindow(): Window {
	return window;
}
