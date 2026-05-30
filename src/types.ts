// ── Citation formats ──────────────────────────────────────────────────────────

export type CitationFormatType =
	| 'latex'
	| 'biblatex'
	| 'pandoc'
	| 'formatted-citation'
	| 'formatted-bibliography'
	| 'template';

export interface CitationFormat {
	name: string;
	format: CitationFormatType;
	command?: string;
	brackets?: boolean;
	cslStyle?: string;
	template?: string;
}

// ── Export formats ────────────────────────────────────────────────────────────

export interface ExportFormat {
	name: string;
	outputPathTemplate: string;
	imageOutputPathTemplate: string;
	imageBaseNameTemplate: string;
	templatePath?: string;
	cslStyle?: string;
}

// ── Database / connection ─────────────────────────────────────────────────────

export type Database = 'Zotero' | 'Juris-M' | 'Custom';

export interface DatabaseWithPort {
	database: Database;
	port?: string;
}

export type ConnectionMode = 'bbt' | 'webapi' | 'none';

// ── Settings ──────────────────────────────────────────────────────────────────

export type NotesToOpenAfterImport =
	| 'first-imported-note'
	| 'last-imported-note'
	| 'all-imported-notes';

export interface ZoteroManagerSettings {
	// Connection
	database: Database;
	port?: string;
	// Web API fallback
	webApiKey?: string;
	webApiUserId?: string;
	// Citation
	citeFormats: CitationFormat[];
	citeSuggestTemplate: string;
	// Export
	exportFormats: ExportFormat[];
	// Notes
	noteImportFolder: string;
	openNoteAfterImport: boolean;
	whichNotesToOpenAfterImport: NotesToOpenAfterImport;
	// Annotations
	shouldConcat: boolean;
	// PDF image extraction settings (retained for compatibility, unused without binary)
	pdfExportImageDPI: number;
	pdfExportImageFormat: string;
	pdfExportImageQuality: number;
}

export const DEFAULT_SETTINGS: ZoteroManagerSettings = {
	database: 'Zotero',
	citeFormats: [],
	citeSuggestTemplate: '[[{{citekey}}]]',
	exportFormats: [],
	noteImportFolder: '',
	openNoteAfterImport: false,
	whichNotesToOpenAfterImport: 'first-imported-note',
	shouldConcat: false,
	pdfExportImageDPI: 120,
	pdfExportImageFormat: 'jpg',
	pdfExportImageQuality: 90,
};

// ── Shared data structures ────────────────────────────────────────────────────

export interface CiteKey {
	key: string;
	library: number;
}

export interface CiteKeyExport {
	libraryID: number;
	citekey: string;
	title: string;
}

export interface ExportToMarkdownParams {
	settings: ZoteroManagerSettings;
	database: DatabaseWithPort;
	exportFormat: ExportFormat;
}

export interface RenderCiteTemplateParams {
	database: DatabaseWithPort;
	format: CitationFormat;
}
