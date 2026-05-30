import { EditableFileView, Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, ZoteroManagerSettings } from './types';
import { isBBTRunning, detectMode, warnNoConnection } from './zotero/connection';
import { getCAYW, getCiteKeys } from './zotero/cayw';
import { renderCiteTemplate, exportToMarkdown } from './export/export';
import { noteExportPrompt, insertNotesIntoCurrentDoc, filesFromNotes } from './export/exportNotes';
import { ZoteroManagerSettingsTab } from './settings/settings';
import { CiteSuggest } from './ui/CiteSuggest';
import { DataExplorerView, DATA_EXPLORER_VIEW } from './ui/DataExplorerView';

const CMD_PREFIX = 'zotero-manager:';
const CITE_CMD_PREFIX = 'zm-cite-';
const EXPORT_CMD_PREFIX = 'zm-export-';

export default class ZoteroManager extends Plugin {
	settings!: ZoteroManagerSettings;
	private citeSuggest!: CiteSuggest;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new ZoteroManagerSettingsTab(this.app, this));

		this.registerView(DATA_EXPLORER_VIEW, (leaf) => new DataExplorerView(leaf, this));

		this.citeSuggest = new CiteSuggest(this.app, this.settings);
		this.registerEditorSuggest(this.citeSuggest);

		// Register configured citation commands
		for (const fmt of this.settings.citeFormats) {
			this.addCiteCommand(fmt);
		}

		// Register configured export commands
		for (const fmt of this.settings.exportFormats) {
			this.addExportCommand(fmt);
		}

		// Built-in commands
		this.addCommand({
			id: 'zm-insert-notes',
			name: 'Insert notes into current document',
			editorCallback: async (editor) => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }
				const notes = await noteExportPrompt(db, this.app.workspace.getActiveFile()?.parent?.path);
				if (notes) insertNotesIntoCurrentDoc(editor, notes);
			},
		});

		this.addCommand({
			id: 'zm-import-notes',
			name: 'Import notes',
			callback: async () => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }
				const notes = await noteExportPrompt(db, this.settings.noteImportFolder);
				if (notes) {
					const paths = await filesFromNotes(this.app, this.settings.noteImportFolder, notes);
					await this.openNotes(paths);
				}
			},
		});

		this.addCommand({
			id: 'zm-data-explorer',
			name: 'Open data explorer',
			callback: () => this.activateDataExplorer(),
		});

		this.addCommand({
			id: 'zm-refresh-citekeys',
			name: 'Refresh cite key cache',
			callback: () => this.citeSuggest.refreshKeys(true),
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(DATA_EXPLORER_VIEW);
	}

	// ── Dynamic commands ──────────────────────────────────────────────────────

	addCiteCommand(format: import('./types').CitationFormat) {
		this.addCommand({
			id: `${CITE_CMD_PREFIX}${format.name}`,
			name: `Insert citation: ${format.name}`,
			editorCallback: async (editor) => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }

				let result: string | null = null;
				if (format.format === 'template' && format.template?.trim()) {
					result = await renderCiteTemplate(this.app, { database: db, format });
				} else {
					result = await getCAYW(format, db);
				}
				if (typeof result === 'string') editor.replaceSelection(result);
			},
		});
	}

	addExportCommand(format: import('./types').ExportFormat) {
		this.addCommand({
			id: `${EXPORT_CMD_PREFIX}${format.name}`,
			name: `Export to Markdown: ${format.name}`,
			callback: async () => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }

				const paths = await exportToMarkdown(this.app, {
					settings: this.settings,
					database: db,
					exportFormat: format,
				});
				await this.openNotes(paths);
			},
		});
	}

	removeCiteCommand(format: import('./types').CitationFormat) {
		(this.app as any).commands.removeCommand(`${CMD_PREFIX}${CITE_CMD_PREFIX}${format.name}`);
	}

	removeExportCommand(format: import('./types').ExportFormat) {
		(this.app as any).commands.removeCommand(`${CMD_PREFIX}${EXPORT_CMD_PREFIX}${format.name}`);
	}

	// ── Open notes after import ───────────────────────────────────────────────

	async openNotes(paths: string[]) {
		if (!this.settings.openNoteAfterImport || !paths.length) return;

		let toOpen: string[] = [];
		switch (this.settings.whichNotesToOpenAfterImport) {
			case 'first-imported-note': toOpen = [paths[0]]; break;
			case 'last-imported-note': toOpen = [paths[paths.length - 1]]; break;
			case 'all-imported-notes': toOpen = paths; break;
		}

		await new Promise((r) => setTimeout(r, 500));

		const leaves = this.app.workspace.getLeavesOfType('markdown');
		for (const p of toOpen) {
			const file = this.app.vault.getAbstractFileByPath(p);
			const existing = leaves.find((l) => (l.view as EditableFileView).file?.path === p);
			if (existing) {
				this.app.workspace.revealLeaf(existing);
			} else if (file instanceof TFile) {
				await this.app.workspace.getLeaf(true).openFile(file);
			}
		}
	}

	// ── Data explorer ─────────────────────────────────────────────────────────

	async activateDataExplorer() {
		this.app.workspace.detachLeavesOfType(DATA_EXPLORER_VIEW);
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: DATA_EXPLORER_VIEW });
			this.app.workspace.revealLeaf(leaf);
		}
	}

	// ── Settings ──────────────────────────────────────────────────────────────

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		if (this.citeSuggest) this.citeSuggest.updateSettings(this.settings);
	}
}
