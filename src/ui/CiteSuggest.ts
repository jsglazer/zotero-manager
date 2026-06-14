import {
	App,
	Editor,
	EditorPosition,
	EditorSuggest,
	EditorSuggestContext,
	EditorSuggestTriggerInfo,
	TFile,
} from 'obsidian';
import Fuse from 'fuse.js';
import { CiteKeyExport, ZoteroManagerSettings } from '../types';
import { getAllCiteKeysForSuggest } from '../zotero/cayw';
import { renderTemplate } from '../export/template.env';

export class CiteSuggest extends EditorSuggest<CiteKeyExport> {
	private settings: ZoteroManagerSettings;
	private fuse: Fuse<CiteKeyExport>;
	private keys: CiteKeyExport[] = [];

	constructor(app: App, settings: ZoteroManagerSettings) {
		super(app);
		this.settings = settings;
		this.fuse = new Fuse<CiteKeyExport>([], {
			keys: ['citekey', 'title'],
			threshold: 0.4,
		});
	}

	updateSettings(settings: ZoteroManagerSettings) {
		this.settings = settings;
	}

	async refreshKeys(force = false) {
		const db = { database: this.settings.database, port: this.settings.port };
		this.keys = await getAllCiteKeysForSuggest(db, force);
		this.fuse.setCollection(this.keys);
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		const line = editor.getLine(cursor.line);
		const sub = line.slice(0, cursor.ch);
		const match = sub.match(/@([\w-]*)$/);
		if (!match) return null;
		return {
			start: { line: cursor.line, ch: cursor.ch - match[0].length },
			end: cursor,
			query: match[1],
		};
	}

	async getSuggestions(ctx: EditorSuggestContext): Promise<CiteKeyExport[]> {
		if (!this.keys.length) await this.refreshKeys();
		if (!ctx.query) return this.keys.slice(0, 10);
		return this.fuse
			.search(ctx.query)
			.map((r) => r.item)
			.slice(0, 10);
	}

	renderSuggestion(item: CiteKeyExport, el: HTMLElement) {
		el.createEl('div', { text: item.citekey, cls: 'zotero-manager-search-result-title' });
		el.createEl('div', { text: item.title, cls: 'zotero-manager-search-result-meta' });
	}

	selectSuggestion(item: CiteKeyExport, _evt: MouseEvent | KeyboardEvent): void {
		const ctx = this.context;
		if (!ctx) return;

		// EditorSuggest.selectSuggestion is void-returning; run the async render
		// fire-and-forget (the base ignores any returned promise anyway).
		void (async () => {
			let insertion = this.settings.citeSuggestTemplate ?? '[[{{citekey}}]]';
			try {
				insertion = await renderTemplate('', insertion, item);
			} catch {
				insertion = `[[${item.citekey}]]`;
			}

			ctx.editor.replaceRange(insertion, ctx.start, ctx.end);
		})();
	}
}
