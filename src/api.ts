import { CiteKey, CiteKeyExport, CitationFormat } from './types';
import type { ZoteroItem } from './zotero/data';

// Public, read-only surface other Obsidian plugins can consume via
// `app.plugins.plugins['zotero-manager']?.api`. Bump `version` only on a
// breaking change — consumers gate on it before calling anything else.
export interface ZoteroManagerAPI {
	version: 1;

	/** Whether Zotero + Better BibTeX are reachable right now. Never shows a Notice. */
	isAvailable(): Promise<boolean>;

	/** Rendered bibliography HTML (default) or Markdown for the given cite keys. */
	getBibliography(
		keys: CiteKey[],
		opts?: { cslStyle?: string; format?: 'html' | 'markdown' },
	): Promise<string | null>;

	/** Runs Cite-As-You-Write for the given format and returns the inserted text. */
	getCitation(format: CitationFormat): Promise<string | null>;

	/** CSL-JSON for the given cite keys within a single library. */
	getItemJSON(keys: CiteKey[], libraryID: number): Promise<ZoteroItem[] | null>;

	/** All cite keys available for autocomplete, 60s-cached unless `force` is set. */
	getAllCiteKeys(force?: boolean): Promise<CiteKeyExport[]>;
}
