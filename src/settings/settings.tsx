import { App, PluginSettingTab, Setting } from 'obsidian';
import type ZoteroManager from '../main';
import { CitationFormat, ExportFormat } from '../types';
import { isBBTRunning } from '../zotero/connection';
import { FolderSuggest } from '../ui/FolderSuggest';

export class ZoteroManagerSettingsTab extends PluginSettingTab {
	plugin: ZoteroManager;

	constructor(app: App, plugin: ZoteroManager) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Connection ──────────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Connection' });

		const dbSetting = new Setting(containerEl)
			.setName('Database')
			.setDesc('Which Zotero-compatible application to connect to.')
			.addDropdown((dd) =>
				dd
					.addOption('Zotero', 'Zotero')
					.addOption('Juris-M', 'Juris-M')
					.addOption('Custom', 'Custom port')
					.setValue(this.plugin.settings.database)
					.onChange(async (v) => {
						this.plugin.settings.database = v as any;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		// Connection status badge
		const badge = dbSetting.controlEl.createEl('span', {
			text: 'Checking…',
			cls: 'zm-connection-badge zm-connection-checking',
		});
		const db = { database: this.plugin.settings.database, port: this.plugin.settings.port };
		isBBTRunning(db, true).then((running) => {
			badge.setText(running ? 'Linked' : 'Not Linked');
			badge.className = `zm-connection-badge ${running ? 'zm-connection-linked' : 'zm-connection-unlinked'}`;
		});

		if (this.plugin.settings.database === 'Custom') {
			new Setting(containerEl)
				.setName('Custom port')
				.setDesc('Port for the Better BibTeX HTTP server.')
				.addText((t) =>
					t
						.setPlaceholder('23119')
						.setValue(this.plugin.settings.port ?? '')
						.onChange(async (v) => {
							this.plugin.settings.port = v;
							await this.plugin.saveSettings();
						})
				);
		}

		// ── Web API fallback ────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Zotero Web API (fallback)' });
		containerEl.createEl('p', {
			text: 'Used automatically when Zotero is not running locally.',
			cls: 'setting-item-description',
		});

		new Setting(containerEl)
			.setName('API key')
			.setDesc('Your Zotero Web API key (from zotero.org/settings/keys).')
			.addText((t) =>
				t
					.setPlaceholder('paste API key here')
					.setValue(this.plugin.settings.webApiKey ?? '')
					.onChange(async (v) => {
						this.plugin.settings.webApiKey = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('User / group ID')
			.setDesc('Your Zotero user ID or group ID.')
			.addText((t) =>
				t
					.setPlaceholder('e.g. 1234567')
					.setValue(this.plugin.settings.webApiUserId ?? '')
					.onChange(async (v) => {
						this.plugin.settings.webApiUserId = v;
						await this.plugin.saveSettings();
					})
			);

		// ── Citation formats ────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Citation formats' });
		containerEl.createEl('p', {
			text: 'Each format becomes an Obsidian command that inserts a citation at the cursor.',
			cls: 'setting-item-description',
		});

		for (const [i, fmt] of this.plugin.settings.citeFormats.entries()) {
			this.renderCiteFormat(containerEl, fmt, i);
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('+ Add citation format')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.citeFormats.push({
						name: `Format ${this.plugin.settings.citeFormats.length + 1}`,
						format: 'pandoc',
					});
					await this.plugin.saveSettings();
					this.display();
				})
		);

		// ── Export formats ──────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Export formats' });
		containerEl.createEl('p', {
			text: 'Each format becomes an Obsidian command that exports selected Zotero items to Markdown.',
			cls: 'setting-item-description',
		});

		for (const [i, fmt] of this.plugin.settings.exportFormats.entries()) {
			this.renderExportFormat(containerEl, fmt, i);
		}

		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText('+ Add export format')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.exportFormats.push({
						name: `Export ${this.plugin.settings.exportFormats.length + 1}`,
						outputPathTemplate: '{{citekey}}.md',
						imageOutputPathTemplate: 'images/{{citekey}}',
						imageBaseNameTemplate: '{{citekey}}-{{page}}',
					});
					await this.plugin.saveSettings();
					this.display();
				})
		);

		// ── Notes ───────────────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Notes' });

		new Setting(containerEl)
			.setName('Note import folder')
			.setDesc('Vault path where imported Zotero notes are saved.')
			.addText((t) => {
				t.setPlaceholder('e.g. Zotero/Notes').setValue(this.plugin.settings.noteImportFolder);
				new FolderSuggest(this.app, t.inputEl);
				t.onChange(async (v) => {
					this.plugin.settings.noteImportFolder = v;
					await this.plugin.saveSettings();
				});
				return t;
			});

		new Setting(containerEl)
			.setName('Open note after import')
			.addToggle((tg) =>
				tg
					.setValue(this.plugin.settings.openNoteAfterImport)
					.onChange(async (v) => {
						this.plugin.settings.openNoteAfterImport = v;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.openNoteAfterImport) {
			new Setting(containerEl)
				.setName('Which note to open')
				.addDropdown((dd) =>
					dd
						.addOption('first-imported-note', 'First')
						.addOption('last-imported-note', 'Last')
						.addOption('all-imported-notes', 'All')
						.setValue(this.plugin.settings.whichNotesToOpenAfterImport)
						.onChange(async (v) => {
							this.plugin.settings.whichNotesToOpenAfterImport = v as any;
							await this.plugin.saveSettings();
						})
				);
		}

		// ── Autocomplete ────────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Cite key autocomplete' });

		new Setting(containerEl)
			.setName('Insertion template')
			.setDesc('Template used when a suggestion is selected. Use {{citekey}}, {{title}}, etc.')
			.addText((t) =>
				t
					.setPlaceholder('[[{{citekey}}]]')
					.setValue(this.plugin.settings.citeSuggestTemplate)
					.onChange(async (v) => {
						this.plugin.settings.citeSuggestTemplate = v;
						await this.plugin.saveSettings();
					})
			);

		// ── Annotations ─────────────────────────────────────────────────────────
		containerEl.createEl('h2', { text: 'Annotations' });

		new Setting(containerEl)
			.setName('Concatenate annotations')
			.setDesc('Merge consecutive annotations whose comment starts with "+ ".')
			.addToggle((tg) =>
				tg
					.setValue(this.plugin.settings.shouldConcat)
					.onChange(async (v) => {
						this.plugin.settings.shouldConcat = v;
						await this.plugin.saveSettings();
					})
			);
	}

	private renderCiteFormat(el: HTMLElement, fmt: CitationFormat, index: number) {
		const originalName = fmt.name;

		new Setting(el)
			.setName(`Citation format: ${fmt.name}`)
			.addText((t) =>
				t
					.setPlaceholder('Name')
					.setValue(fmt.name)
					.onChange(async (v) => {
						this.plugin.settings.citeFormats[index].name = v;
						await this.plugin.saveSettings();
					})
			)
			.addDropdown((dd) =>
				dd
					.addOption('pandoc', 'Pandoc')
					.addOption('latex', 'LaTeX')
					.addOption('biblatex', 'BibLaTeX')
					.addOption('formatted-citation', 'Formatted citation')
					.addOption('formatted-bibliography', 'Formatted bibliography')
					.addOption('template', 'Template')
					.setValue(fmt.format)
					.onChange(async (v) => {
						this.plugin.settings.citeFormats[index].format = v as any;
						await this.plugin.saveSettings();
						this.display();
					})
			)
			.addButton((btn) =>
				btn
					.setIcon('trash')
					.setTooltip('Remove')
					.onClick(async () => {
						this.plugin.settings.citeFormats.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (fmt.format === 'template') {
			new Setting(el)
				.setName('Template')
				.setDesc('Nunjucks template. Available: citekey, title, authors, year, etc.')
				.addTextArea((ta) =>
					ta
						.setValue(fmt.template ?? '')
						.onChange(async (v) => {
							this.plugin.settings.citeFormats[index].template = v;
							await this.plugin.saveSettings();
						})
				);
		}

		if (fmt.format === 'formatted-citation' || fmt.format === 'formatted-bibliography') {
			new Setting(el)
				.setName('CSL style')
				.setDesc('Citation style ID (leave blank to use Zotero default).')
				.addText((t) =>
					t
						.setPlaceholder('e.g. apa')
						.setValue(fmt.cslStyle ?? '')
						.onChange(async (v) => {
							this.plugin.settings.citeFormats[index].cslStyle = v;
							await this.plugin.saveSettings();
						})
				);
		}

		if (fmt.format === 'latex' || fmt.format === 'biblatex') {
			new Setting(el)
				.setName('Command')
				.setDesc('LaTeX/BibLaTeX cite command (e.g. cite, autocite, parencite).')
				.addText((t) =>
					t
						.setPlaceholder(fmt.format === 'latex' ? 'cite' : 'autocite')
						.setValue(fmt.command ?? '')
						.onChange(async (v) => {
							this.plugin.settings.citeFormats[index].command = v;
							await this.plugin.saveSettings();
						})
				);
		}

		if (fmt.format === 'pandoc') {
			new Setting(el)
				.setName('Brackets')
				.setDesc('Wrap citation in square brackets.')
				.addToggle((tg) =>
					tg
						.setValue(fmt.brackets ?? false)
						.onChange(async (v) => {
							this.plugin.settings.citeFormats[index].brackets = v;
							await this.plugin.saveSettings();
						})
				);
		}
	}

	private renderExportFormat(el: HTMLElement, fmt: ExportFormat, index: number) {
		new Setting(el)
			.setName(`Export format: ${fmt.name}`)
			.addText((t) =>
				t
					.setPlaceholder('Name')
					.setValue(fmt.name)
					.onChange(async (v) => {
						this.plugin.settings.exportFormats[index].name = v;
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn
					.setIcon('trash')
					.setTooltip('Remove')
					.onClick(async () => {
						this.plugin.settings.exportFormats.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(el)
			.setName('Template path')
			.setDesc('Vault path to the Nunjucks template file.')
			.addText((t) =>
				t
					.setPlaceholder('Templates/zotero.md')
					.setValue(fmt.templatePath ?? '')
					.onChange(async (v) => {
						this.plugin.settings.exportFormats[index].templatePath = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName('Output path template')
			.setDesc('Nunjucks template for the output file path.')
			.addText((t) =>
				t
					.setPlaceholder('{{citekey}}.md')
					.setValue(fmt.outputPathTemplate)
					.onChange(async (v) => {
						this.plugin.settings.exportFormats[index].outputPathTemplate = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName('Image output path template')
			.setDesc('Where to store exported annotation images.')
			.addText((t) =>
				t
					.setPlaceholder('images/{{citekey}}')
					.setValue(fmt.imageOutputPathTemplate)
					.onChange(async (v) => {
						this.plugin.settings.exportFormats[index].imageOutputPathTemplate = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName('Image base name template')
			.setDesc('Template for image file names.')
			.addText((t) =>
				t
					.setPlaceholder('{{citekey}}-{{page}}')
					.setValue(fmt.imageBaseNameTemplate)
					.onChange(async (v) => {
						this.plugin.settings.exportFormats[index].imageBaseNameTemplate = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(el)
			.setName('CSL style')
			.setDesc('Citation style for the bibliography field in template data (optional).')
			.addText((t) =>
				t
					.setPlaceholder('e.g. apa')
					.setValue(fmt.cslStyle ?? '')
					.onChange(async (v) => {
						this.plugin.settings.exportFormats[index].cslStyle = v;
						await this.plugin.saveSettings();
					})
			);
	}
}
