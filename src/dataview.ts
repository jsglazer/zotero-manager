import { App, TFile } from 'obsidian';
import type ZoteroManager from './main';

// ── Citation pattern detection ────────────────────────────────────────────────

// @citekey  or  [@citekey]  or  [@key1; @key2]
const PANDOC_RE = /@([\w][\\w:./-]*)/g;

// \cite{key}, \autocite{key,key2}, \parencite{key}, etc.
const LATEX_RE = /\\(?:cite|autocite|parencite|textcite|footcite|nocite|citep|citet|Cite|Autocite)\*?\{([^}]+)\}/g;

export function extractCiteKeys(content: string): string[] {
	const keys = new Set<string>();

	for (const m of content.matchAll(PANDOC_RE)) {
		const k = m[1].trim();
		if (k && !k.includes(' ')) keys.add(k);
	}

	for (const m of content.matchAll(LATEX_RE)) {
		for (const k of m[1].split(',')) {
			const trimmed = k.trim();
			if (trimmed) keys.add(trimmed);
		}
	}

	return [...keys];
}

// ── Dataview integration ──────────────────────────────────────────────────────

export class DataviewIntegration {
	private plugin: ZoteroManager;
	private app: App;

	constructor(plugin: ZoteroManager) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	private dvPages(): Map<string, any> | undefined {
		return (this.app as any).plugins?.plugins?.['dataview']?.api?.index?.pages;
	}

	setup() {
		if (!this.dvPages()) return;

		// Re-inject whenever Dataview re-indexes a file
		this.plugin.registerEvent(
			(this.app.metadataCache as any).on(
				'dataview:metadata-change',
				(type: string, file: TFile) => {
					if (type === 'update' && file instanceof TFile) {
						this.injectForFile(file);
					}
				}
			)
		);

		// Initial pass over all existing notes
		for (const file of this.app.vault.getMarkdownFiles()) {
			this.injectForFile(file);
		}
	}

	async injectForFile(file: TFile) {
		const pages = this.dvPages();
		if (!pages) return;

		const page = pages.get(file.path);
		if (!page) return;

		const content = await this.app.vault.cachedRead(file);
		const keys = extractCiteKeys(content);

		if (keys.length > 0) {
			page.fields.set('citekeys', keys);
		} else {
			page.fields.delete('citekeys');
		}
	}

	// Called immediately after a citation is inserted so Dataview reflects it
	// before the file-change event fires.
	async injectForActiveFile() {
		const file = this.app.workspace.getActiveFile();
		if (file) await this.injectForFile(file);
	}

	// Called after an import-notes file is created. Polls briefly since the
	// file may not be in Dataview's index yet.
	injectForImportedNote(
		filePath: string,
		citekey: string,
		item?: { title?: string; authorString?: string; year?: string }
	) {
		const attempt = (remaining: number) => {
			const pages = this.dvPages();
			const page = pages?.get(filePath);
			if (page) {
				page.fields.set('citekeys', [citekey]);
				if (item?.title)        page.fields.set('title',   item.title);
				if (item?.authorString) page.fields.set('authors', item.authorString);
				if (item?.year)         page.fields.set('year',    item.year);
			} else if (remaining > 0) {
				setTimeout(() => attempt(remaining - 1), 500);
			}
		};
		attempt(6); // up to 3 seconds
	}
}
