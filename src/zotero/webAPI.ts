// Zotero Web API fallback — used when BBT is not available.
// Docs: https://www.zotero.org/support/dev/web_api/v3/basics

import { Notice, request } from 'obsidian';
import { CiteKey, CiteKeyExport, ZoteroManagerSettings } from '../types';

const API_BASE = 'https://api.zotero.org';

function headers(apiKey: string) {
	return {
		'Zotero-API-Key': apiKey,
		'Zotero-API-Version': '3',
		Accept: 'application/json',
	};
}

function userBase(settings: ZoteroManagerSettings): string {
	return `${API_BASE}/users/${settings.webApiUserId}`;
}

// ── Key validation ────────────────────────────────────────────────────────────

export async function validateWebApiKey(apiKey: string, userId: string): Promise<boolean> {
	if (!apiKey || !userId) return false;
	try {
		await request({
			method: 'GET',
			url: `${API_BASE}/users/${userId}/items?limit=1&format=json`,
			headers: headers(apiKey),
		});
		return true;
	} catch {
		return false;
	}
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface WebAPIItem {
	key: string;
	data: Record<string, any>;
}

export async function searchItems(
	query: string,
	settings: ZoteroManagerSettings,
): Promise<WebAPIItem[]> {
	if (!settings.webApiKey || !settings.webApiUserId) return [];
	try {
		const res = await request({
			method: 'GET',
			url: `${userBase(settings)}/items?q=${encodeURIComponent(query)}&format=json&limit=25`,
			headers: headers(settings.webApiKey),
		});
		return JSON.parse(res);
	} catch (e) {
		console.error(e);
		new Notice(`Zotero Web API search error: ${(e as Error).message}`, 10000);
		return [];
	}
}

// ── Fetch item + children ────────────────────────────────────────────────────

export async function fetchItem(
	itemKey: string,
	settings: ZoteroManagerSettings,
): Promise<WebAPIItem | null> {
	if (!settings.webApiKey || !settings.webApiUserId) return null;
	try {
		const res = await request({
			method: 'GET',
			url: `${userBase(settings)}/items/${itemKey}?format=json`,
			headers: headers(settings.webApiKey),
		});
		return JSON.parse(res);
	} catch (e) {
		console.error(e);
		return null;
	}
}

export async function fetchChildren(
	itemKey: string,
	settings: ZoteroManagerSettings,
): Promise<WebAPIItem[]> {
	if (!settings.webApiKey || !settings.webApiUserId) return [];
	try {
		const res = await request({
			method: 'GET',
			url: `${userBase(settings)}/items/${itemKey}/children?format=json`,
			headers: headers(settings.webApiKey),
		});
		return JSON.parse(res);
	} catch (e) {
		console.error(e);
		return [];
	}
}

// ── Bibliography ──────────────────────────────────────────────────────────────

export async function getBibliography(
	itemKeys: string[],
	settings: ZoteroManagerSettings,
	cslStyle?: string,
): Promise<string | null> {
	if (!settings.webApiKey || !settings.webApiUserId || !itemKeys.length) return null;
	const styleParam = cslStyle ? `&style=${encodeURIComponent(cslStyle)}` : '';
	try {
		const res = await request({
			method: 'GET',
			url: `${userBase(settings)}/items?format=bib${styleParam}` + `&itemKey=${itemKeys.join(',')}`,
			headers: headers(settings.webApiKey),
		});
		// Response is HTML bibliography — strip tags for plain markdown
		return res.replace(/<[^>]+>/g, '').trim();
	} catch (e) {
		console.error(e);
		new Notice(`Error fetching bibliography from Zotero Web API: ${(e as Error).message}`, 10000);
		return null;
	}
}

// ── All items for autocomplete ────────────────────────────────────────────────

let cachedKeys: CiteKeyExport[] = [];
let lastCheck = 0;

export async function getAllItemsForSuggest(
	settings: ZoteroManagerSettings,
	force = false,
): Promise<CiteKeyExport[]> {
	if (!settings.webApiKey || !settings.webApiUserId) return [];
	if (!force && cachedKeys.length && Date.now() - lastCheck < 60_000) return cachedKeys;

	try {
		const res = await request({
			method: 'GET',
			url: `${userBase(settings)}/items?format=json&limit=100&itemType=-attachment`,
			headers: headers(settings.webApiKey),
		});
		const items: WebAPIItem[] = JSON.parse(res);
		cachedKeys = items
			.filter((i) => i.data?.title)
			.map((i) => ({
				libraryID: Number(settings.webApiUserId) || 1,
				citekey: i.data.citationKey ?? i.key,
				title: i.data.title,
			}));
		lastCheck = Date.now();
		return cachedKeys;
	} catch (e) {
		console.error(e);
		return cachedKeys;
	}
}
