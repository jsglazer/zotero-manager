import { Notice, request } from 'obsidian';
import { Database, DatabaseWithPort, ConnectionMode } from '../types';

export const DEFAULT_HEADERS = {
	'Content-Type': 'application/json',
	'User-Agent': 'obsidian/zotero-manager',
	Accept: 'application/json',
	Connection: 'keep-alive',
};

export function getPort(database: Database, port?: string): string {
	if (database === 'Zotero') return '23119';
	if (database === 'Juris-M') return '24119';
	return port ?? '23119';
}

export function getBBTBase(db: DatabaseWithPort): string {
	return `http://127.0.0.1:${getPort(db.database, db.port)}/better-bibtex`;
}

// ── BBT connectivity probe ────────────────────────────────────────────────────

let cachedBBTRunning = false;
let lastBBTCheck = 0;

export async function isBBTRunning(db: DatabaseWithPort, silent = false): Promise<boolean> {
	if (cachedBBTRunning && Date.now() - lastBBTCheck < 30_000) {
		return cachedBBTRunning;
	}

	try {
		const res = await request({
			method: 'GET',
			url: `${getBBTBase(db)}/cayw?probe=true`,
			headers: DEFAULT_HEADERS,
		});
		cachedBBTRunning = res === 'ready';
		lastBBTCheck = Date.now();
		return cachedBBTRunning;
	} catch {
		cachedBBTRunning = false;
		lastBBTCheck = Date.now();
		if (!silent) {
			new Notice(
				'Cannot connect to Zotero. Please ensure it is running and the Better BibTeX plugin is installed.',
				10000,
			);
		}
		return false;
	}
}

// ── Mode detection ────────────────────────────────────────────────────────────

export async function detectMode(
	db: DatabaseWithPort,
	webApiKey?: string,
): Promise<ConnectionMode> {
	if (await isBBTRunning(db, true)) return 'bbt';
	if (webApiKey) return 'webapi';
	return 'none';
}

export function warnNoConnection() {
	new Notice(
		'Zotero Manager: Cannot connect to Zotero.\n' +
			'Either start Zotero with Better BibTeX, or configure a Zotero Web API key in settings.',
		10000,
	);
}
