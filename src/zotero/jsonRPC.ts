import { Notice, htmlToMarkdown, request } from 'obsidian';
import { moment, type Moment } from '../moment';
import { CiteKey, CiteKeyExport, DatabaseWithPort } from '../types';
import type { ZoteroAttachment, ZoteroCollection, ZoteroItem } from './data';
import { padNumber } from '../helpers';
import { DEFAULT_HEADERS, getBBTBase } from './connection';
import { ZQueue } from './queue';

async function rpc<T = unknown>(
	db: DatabaseWithPort,
	method: string,
	params: unknown[] = [],
): Promise<T> {
	const qid = Symbol();
	await ZQueue.wait(qid);
	try {
		const res = await request({
			method: 'POST',
			url: `${getBBTBase(db)}/json-rpc`,
			body: JSON.stringify({ jsonrpc: '2.0', method, params }),
			headers: DEFAULT_HEADERS,
		});
		ZQueue.end(qid);
		const parsed = JSON.parse(res) as { error?: { message?: string }; result: T };
		if (parsed.error?.message) throw new Error(parsed.error.message);
		return parsed.result;
	} catch (e) {
		ZQueue.end(qid);
		throw e;
	}
}

// ── Item search ───────────────────────────────────────────────────────────────

export async function execSearch(term: string, db: DatabaseWithPort): Promise<ZoteroItem[] | null> {
	try {
		return await rpc<ZoteroItem[]>(db, 'item.search', [term]);
	} catch (e) {
		console.error(e);
		new Notice(`Zotero search error: ${(e as Error).message}`, 10000);
		return null;
	}
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNotesFromCiteKeys(
	citeKeys: CiteKey[],
	db: DatabaseWithPort,
): Promise<Record<string, string[]> | null> {
	try {
		return await rpc<Record<string, string[]>>(db, 'item.notes', [citeKeys.map((k) => k.key)]);
	} catch (e) {
		console.error(e);
		new Notice(`Error retrieving notes: ${(e as Error).message}`, 10000);
		return null;
	}
}

// ── Collections ───────────────────────────────────────────────────────────────

export async function getCollectionFromCiteKey(
	citeKey: CiteKey,
	db: DatabaseWithPort,
): Promise<ZoteroCollection[] | null> {
	try {
		const result = await rpc<Record<string, ZoteroCollection[]>>(db, 'item.collections', [
			[citeKey.key],
			true,
		]);
		const cols = result[citeKey.key];
		if (!cols) return [];
		return cols.map((c) => {
			let pointer: ZoteroCollection = c;
			const fullPath = [c.name];
			while (pointer.parentCollection) {
				fullPath.push(pointer.parentCollection.name);
				pointer = pointer.parentCollection;
			}
			return { key: c.key, name: c.name, fullPath: fullPath.reverse().join('/') };
		});
	} catch (e) {
		console.error(e);
		return null;
	}
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function getAttachmentsFromCiteKey(
	citeKey: CiteKey,
	db: DatabaseWithPort,
): Promise<ZoteroAttachment[] | null> {
	try {
		return await rpc<ZoteroAttachment[]>(db, 'item.attachments', [citeKey.key, citeKey.library]);
	} catch (e) {
		console.error(e);
		return null;
	}
}

// ── Bibliography ──────────────────────────────────────────────────────────────

export async function getBibFromCiteKeys(
	citeKeys: CiteKey[],
	db: DatabaseWithPort,
	cslStyle?: string,
	format?: string,
	silent = false,
): Promise<string | null> {
	if (!citeKeys.length) return null;
	try {
		const params: Record<string, unknown> = { quickCopy: true, contentType: 'html' };
		if (cslStyle) {
			delete params.quickCopy;
			params.id = cslStyle;
		}
		const result = await rpc<string>(db, 'item.bibliography', [
			citeKeys.map((k) => k.key),
			params,
			citeKeys[0].library,
		]);
		if (format === 'html') return result;
		return htmlToMarkdown(result);
	} catch (e) {
		console.error(e);
		if (!silent) new Notice(`Error retrieving bibliography: ${(e as Error).message}`, 10000);
		return null;
	}
}

export function getBibFromCiteKey(
	citeKey: CiteKey,
	db: DatabaseWithPort,
	cslStyle?: string,
	format?: string,
	silent = false,
) {
	return getBibFromCiteKeys([citeKey], db, cslStyle, format, silent);
}

// ── Item JSON (CSL) ───────────────────────────────────────────────────────────

const CSL_TRANSLATOR = '36a3b0b5-bad0-4a04-b79b-441c7cef77db';
const DATE_TRANSLATOR = 'f4b52ab0-f878-4556-85a0-c7aeedd09dfc';

export async function getItemJSONFromCiteKeys(
	citeKeys: CiteKey[],
	db: DatabaseWithPort,
	libraryID: number,
): Promise<ZoteroItem[] | null> {
	try {
		const result = await rpc<string | unknown[]>(db, 'item.export', [
			citeKeys.map((k) => k.key),
			CSL_TRANSLATOR,
			libraryID,
		]);
		const parsed = (
			Array.isArray(result) ? JSON.parse(result[2] as string) : JSON.parse(result)
		) as { items: ZoteroItem[] };
		return parsed.items;
	} catch (e) {
		console.error(e);
		new Notice(`Error retrieving item data: ${(e as Error).message}`, 10000);
		return null;
	}
}

export async function getIssueDateFromCiteKey(
	citeKey: CiteKey,
	db: DatabaseWithPort,
): Promise<Moment | null> {
	try {
		const result = await rpc<string | unknown[]>(db, 'item.export', [
			[citeKey.key],
			DATE_TRANSLATOR,
			citeKey.library,
		]);
		const items = (
			Array.isArray(result) ? JSON.parse(result[2] as string) : JSON.parse(result)
		) as ZoteroItem[];

		for (const item of items) {
			const parts = item.issued?.['date-parts']?.[0];
			if (!parts?.length) continue;
			const [y, m, d] = parts;
			return moment(`${y}-${m ? padNumber(m) : '01'}-${d ? padNumber(d) : '01'}`, 'YYYY-MM-DD');
		}
		return null;
	} catch (e) {
		console.error(e);
		return null;
	}
}

// ── Cite-key export (all keys in a library) ───────────────────────────────────

export async function getUserGroups(
	db: DatabaseWithPort,
): Promise<Array<{ id: number | string; name: string }> | null> {
	try {
		return await rpc<Array<{ id: number | string; name: string }>>(db, 'user.groups', []);
	} catch (e) {
		console.error(e);
		return null;
	}
}

export async function getCiteKeyExport(
	db: DatabaseWithPort,
	groupId: string,
	groupName: string,
): Promise<CiteKeyExport[] | null> {
	const qid = Symbol();
	try {
		await ZQueue.wait(qid);
		const res = await request({
			method: 'GET',
			url: `${getBBTBase(db)}/export/library?/${groupId}/${groupName}.${DATE_TRANSLATOR}`,
			headers: DEFAULT_HEADERS,
		});
		ZQueue.end(qid);
		const entries: unknown = JSON.parse(res);
		if (!Array.isArray(entries)) return null;
		return (entries as Array<{ 'citation-key'?: string; title?: string }>)
			.map((e): CiteKeyExport | null => {
				const citekey = e['citation-key'];
				const title = e['title'];
				if (!citekey || !title) return null;
				return { libraryID: Number(groupId), citekey, title };
			})
			.filter((k): k is CiteKeyExport => k !== null);
	} catch (e) {
		ZQueue.end(qid);
		return null;
	}
}

let cachedAllKeys: CiteKeyExport[] = [];
let lastAllKeysCheck = 0;

export async function getAllCiteKeys(
	db: DatabaseWithPort,
	force = false,
): Promise<{ citekeys: CiteKeyExport[]; fromCache: boolean }> {
	if (!force && cachedAllKeys.length && Date.now() - lastAllKeysCheck < 60_000) {
		return { citekeys: cachedAllKeys, fromCache: true };
	}
	const groups = await getUserGroups(db);
	if (!groups) return { citekeys: cachedAllKeys, fromCache: true };

	const all: CiteKeyExport[] = [];
	for (const g of groups) {
		const keys = await getCiteKeyExport(db, String(g.id), g.name);
		if (keys) all.push(...keys);
	}
	cachedAllKeys = all;
	lastAllKeysCheck = Date.now();
	return { citekeys: all, fromCache: false };
}

// ── Relations ─────────────────────────────────────────────────────────────────

export async function getItemJSONFromRelations(
	libraryID: number,
	relations: string[],
	db: DatabaseWithPort,
): Promise<ZoteroItem[]> {
	const uriMap: Record<string, string> = {};
	const idOrder: string[] = [];
	const idMap: Record<string, ZoteroItem> = {};
	const citekeys: CiteKey[] = [];

	try {
		const result = await rpc<Record<string, string>>(db, 'item.citationkey', [
			relations.map((r) => {
				const id = r.split('/').pop()!;
				idOrder.push(id);
				uriMap[id] = r;
				return `${libraryID}:${id}`;
			}),
		]);

		for (const k of Object.keys(result)) {
			const id = k.split(':').pop()!;
			if (result[k]) {
				citekeys.push({ key: result[k], library: libraryID });
				idMap[id] = { citekey: result[k], uri: uriMap[id] };
			} else {
				idMap[id] = { uri: uriMap[id] };
			}
		}
	} catch (e) {
		console.error(e);
		return [];
	}

	const items: ZoteroItem[] = citekeys.length
		? ((await getItemJSONFromCiteKeys(citekeys, db, libraryID)) ?? [])
		: [];

	return idOrder.map((id) => {
		if (idMap[id]?.citekey) {
			const item = items.find((i) => (i.citekey || i.citationKey) === idMap[id].citekey);
			if (item) return item;
		}
		return idMap[id];
	});
}
