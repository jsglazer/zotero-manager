import { App } from 'obsidian';

export function getVaultRoot(app: App): string {
	return (app.vault.adapter as any).getBasePath();
}

export function padNumber(n: number): string {
	return n < 10 ? `0${n}` : `${n}`;
}

// Bring the Obsidian window back to front after CAYW opens Zotero.
// Uses Electron's remote API when available; falls back to window.focus().
export function focusObsidian(): void {
	try {
		const remote = (window as any).require?.('electron')?.remote;
		if (remote) {
			const win = remote.getCurrentWindow();
			win?.show();
			win?.focus();
			return;
		}
	} catch { /* not in Electron or remote disabled */ }
	window.focus();
}
