import { EditableFileView, Notice, Plugin, TFile } from 'obsidian';
import { DEFAULT_SETTINGS, ZoteroManagerSettings } from './types';
import { detectMode, warnNoConnection } from './zotero/connection';
import { getCAYW, getCiteKeys } from './zotero/cayw';
import { renderCiteTemplate, exportToMarkdown } from './export/export';
import { noteExportPrompt, insertNotesIntoCurrentDoc, filesFromNotes } from './export/exportNotes';
import { ZoteroManagerSettingsTab } from './settings/settings';
import { CiteSuggest } from './ui/CiteSuggest';
import { DataExplorerView, DATA_EXPLORER_VIEW } from './ui/DataExplorerView';
import { DataviewIntegration } from './dataview';

const CMD_PREFIX = 'zotero-manager:';
const CITE_CMD_PREFIX = 'zm-cite-';
const EXPORT_CMD_PREFIX = 'zm-export-';

export default class ZoteroManager extends Plugin {
	settings!: ZoteroManagerSettings;
	dataview!: DataviewIntegration;
	private citeSuggest!: CiteSuggest;
	private registeredCiteCommandIds = new Set<string>();
	private registeredExportCommandIds = new Set<string>();

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new ZoteroManagerSettingsTab(this.app, this));

		this.registerView(DATA_EXPLORER_VIEW, (leaf) => new DataExplorerView(leaf, this));

		this.citeSuggest = new CiteSuggest(this.app, this.settings);
		this.registerEditorSuggest(this.citeSuggest);

		this.dataview = new DataviewIntegration(this);
		this.app.workspace.onLayoutReady(() => this.dataview.setup());

		// Register configured citation commands
		for (const fmt of this.settings.citeFormats) {
			this._registerCiteCommand(fmt);
		}

		// Register configured export commands
		for (const fmt of this.settings.exportFormats) {
			this._registerExportCommand(fmt);
		}

		// Built-in commands
		this.addCommand({
			id: 'zm-insert-notes',
			name: 'Insert notes into current document',
			editorCallback: async (editor) => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }
				const notes = await noteExportPrompt(db, this.app.workspace.getActiveFile()?.parent?.path, this.settings.colorLabels);
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
				const notes = await noteExportPrompt(db, this.settings.noteImportFolder, this.settings.colorLabels);
				if (notes) {
					const imported = await filesFromNotes(this.app, this.settings.noteImportFolder, notes);
					for (const { path, citekey } of imported) {
						this.dataview.injectForImportedNote(path, citekey);
					}
					await this.openNotes(imported.map((i) => i.path));
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

	// ── Dynamic command registration ──────────────────────────────────────────

	private _registerCiteCommand(format: import('./types').CitationFormat) {
		const id = `${CITE_CMD_PREFIX}${format.name}`;
		if (this.registeredCiteCommandIds.has(id)) return;
		this.addCommand({
			id,
			name: `Insert citation: ${format.name}`,
			editorCallback: async (editor) => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }

				// Re-read format from current settings so name/template changes are picked up
				const current = this.settings.citeFormats.find((f) => f.name === format.name) ?? format;
				let result: string | null = null;
				if (current.format === 'template' && current.template?.trim()) {
					result = await renderCiteTemplate(this.app, { database: db, format: current });
				} else {
					result = await getCAYW(current, db);
				}
				if (typeof result === 'string') {
				editor.replaceSelection(result);
				await this.dataview.injectForActiveFile();
			}
			},
		});
		this.registeredCiteCommandIds.add(id);
	}

	private _registerExportCommand(format: import('./types').ExportFormat) {
		const id = `${EXPORT_CMD_PREFIX}${format.name}`;
		if (this.registeredExportCommandIds.has(id)) return;
		this.addCommand({
			id,
			name: `Export to Markdown: ${format.name}`,
			callback: async () => {
				const db = { database: this.settings.database, port: this.settings.port };
				const mode = await detectMode(db, this.settings.webApiKey);
				if (mode === 'none') { warnNoConnection(); return; }

				const current = this.settings.exportFormats.find((f) => f.name === format.name) ?? format;
				const paths = await exportToMarkdown(this.app, {
					settings: this.settings,
					database: db,
					exportFormat: current,
				});
				await this.openNotes(paths);
			},
		});
		this.registeredExportCommandIds.add(id);
	}

	private _removeCommand(fullId: string) {
		(this.app as any).commands.removeCommand(fullId);
	}

	// Called from settings whenever formats change — removes stale commands and adds new ones.
	reconcileCommands() {
		const currentCiteIds = new Set(this.settings.citeFormats.map((f) => `${CITE_CMD_PREFIX}${f.name}`));
		const currentExportIds = new Set(this.settings.exportFormats.map((f) => `${EXPORT_CMD_PREFIX}${f.name}`));

		// Remove stale cite commands
		for (const id of this.registeredCiteCommandIds) {
			if (!currentCiteIds.has(id)) {
				this._removeCommand(`${CMD_PREFIX}${id}`);
				this.registeredCiteCommandIds.delete(id);
			}
		}
		// Remove stale export commands
		for (const id of this.registeredExportCommandIds) {
			if (!currentExportIds.has(id)) {
				this._removeCommand(`${CMD_PREFIX}${id}`);
				this.registeredExportCommandIds.delete(id);
			}
		}

		// Add any new ones
		for (const fmt of this.settings.citeFormats) this._registerCiteCommand(fmt);
		for (const fmt of this.settings.exportFormats) this._registerExportCommand(fmt);
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
		this.reconcileCommands();
	}
}
