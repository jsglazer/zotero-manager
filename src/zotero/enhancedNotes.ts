import { request } from 'obsidian';
import { DatabaseWithPort } from '../types';
import { DEFAULT_HEADERS, getPort } from './connection';

// Enhanced Notes (https://github.com/jsglazer/enhanced-notes) registers this path on
// Zotero's local HTTP server — the same server (default port 23119) Better BibTeX
// registers `/better-bibtex/...` on — so it's reachable via the same `db` connection
// zotero-manager already uses for BBT. Returns null if Enhanced Notes isn't installed,
// isn't running, or the request otherwise fails; callers should keep their own
// color-label defaults in that case rather than treating it as fatal.
export async function getColorLabelsFromEnhancedNotes(
	db: DatabaseWithPort,
): Promise<Record<string, string> | null> {
	try {
		const port = getPort(db.database, db.port);
		const res = await request({
			method: 'GET',
			url: `http://127.0.0.1:${port}/enhanced-notes/color-labels`,
			headers: DEFAULT_HEADERS,
		});
		const parsed = JSON.parse(res) as { colorLabels?: Record<string, string> };
		return parsed.colorLabels ?? null;
	} catch (e) {
		console.error('zotero-manager: could not reach Enhanced Notes', e);
		return null;
	}
}
