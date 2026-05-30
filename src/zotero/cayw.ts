import { Notice, request } from 'obsidian';
import { CiteKey, CiteKeyExport, CitationFormat, DatabaseWithPort } from '../types';
import { DEFAULT_HEADERS, getBBTBase, isBBTRunning } from './connection';
import { getBibFromCiteKeys, getItemJSONFromCiteKeys, getUserGroups } from './jsonRPC';
import { ZQueue } from './queue';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getCiteKeyFromAny(item: any): CiteKey | null {
	if (!item.citekey && !item.citationKey) return null;
	return { key: item.citekey ?? item.citationKey, library: item.libraryID ?? 1 };
}

function buildCAYWQuery(format: CitationFormat): string {
	switch (format.format) {
		case 'formatted-bibliography':
			return 'format=formatted-bibliography';
		case 'formatted-citation':
			return `format=formatted-citation${format.cslStyle ? `&style=${format.cslStyle}` : ''}`;
		case 'pandoc':
			return `format=pandoc${format.brackets ? '&brackets=true' : ''}`;
		case 'latex':
			return `format=latex&command=${format.command ?? 'cite'}`;
		case 'biblatex':
			return `format=biblatex&command=${format.command ?? 'autocite'}`;
		default:
			return 'format=pandoc';
	}
}

// ── Core CAYW calls ───────────────────────────────────────────────────────────

export async function getCAYWRaw(
	db: DatabaseWithPort,
	query: string
): Promise<string | null> {
	if (!(await isBBTRunning(db))) return null;
	const qid = Symbol();
	try {
		await ZQueue.wait(qid);
		const res = await request({
			method: 'GET',
			url: `${getBBTBase(db)}/cayw?${query}`,
			headers: DEFAULT_HEADERS,
		});
		ZQueue.end(qid);
		window.focus();
		return res;
	} catch (e) {
		ZQueue.end(qid);
		window.focus();
		console.error(e);
		new Notice(`Error processing citation: ${(e as Error).message}`, 10000);
		return null;
	}
}

export async function getCAYWJSON(db: DatabaseWithPort): Promise<any[] | null> {
	const res = await getCAYWRaw(
		db,
		'format=translate&translator=36a3b0b5-bad0-4a04-b79b-441c7cef77db&exportNotes=false'
	);
	if (!res) return null;
	try {
		return JSON.parse(res).items ?? [];
	} catch (e) {
		console.error(e);
		return null;
	}
}

export async function getCiteKeys(db: DatabaseWithPort): Promise<CiteKey[]> {
	const json = await getCAYWJSON(db);
	if (!json) return [];
	return json
		.map((e: any) => getCiteKeyFromAny(e))
		.filter((k): k is CiteKey => k !== null);
}

// ── Citation format dispatcher ────────────────────────────────────────────────

export async function getCAYW(
	format: CitationFormat,
	db: DatabaseWithPort
): Promise<string | null> {
	if (format.format === 'formatted-bibliography') {
		const citeKeys = await getCiteKeys(db);
		if (!citeKeys.length) return null;
		return getBibFromCiteKeys(citeKeys, db, format.cslStyle);
	}
	return getCAYWRaw(db, buildCAYWQuery(format));
}

// ── Template-based cite rendering ─────────────────────────────────────────────
// (full impl in export/export.ts; re-exported here for convenience)

// ── All cite-keys for autocomplete ───────────────────────────────────────────

let cachedKeys: CiteKeyExport[] = [];
let lastCheck = 0;

export async function getAllCiteKeysForSuggest(
	db: DatabaseWithPort,
	force = false
): Promise<CiteKeyExport[]> {
	if (!force && cachedKeys.length && Date.now() - lastCheck < 60_000) {
		return cachedKeys;
	}
	if (!(await isBBTRunning(db, true))) return cachedKeys;

	const groups = await getUserGroups(db);
	if (!groups) return cachedKeys;

	const all: CiteKeyExport[] = [];
	for (const g of groups) {
		const qid = Symbol();
		try {
			await ZQueue.wait(qid);
			const res = await request({
				method: 'GET',
				url: `${getBBTBase(db)}/export/library?/${g.id}/${g.name}.f4b52ab0-f878-4556-85a0-c7aeedd09dfc`,
				headers: DEFAULT_HEADERS,
			});
			ZQueue.end(qid);
			const entries: any[] = JSON.parse(res);
			if (Array.isArray(entries)) {
				for (const e of entries) {
					if (e['citation-key'] && e['title']) {
						all.push({ libraryID: Number(g.id), citekey: e['citation-key'], title: e['title'] });
					}
				}
			}
		} catch {
			ZQueue.end(qid);
		}
	}
	cachedKeys = all;
	lastCheck = Date.now();
	return all;
}
