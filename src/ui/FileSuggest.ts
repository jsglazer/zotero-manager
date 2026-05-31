import { AbstractInputSuggest, App, TFile } from 'obsidian';

export class FileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;
	private ext: string;

	constructor(app: App, inputEl: HTMLInputElement, ext = 'md') {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.ext = ext;
	}

	getSuggestions(query: string): TFile[] {
		const lower = query.toLowerCase();
		return this.app.vault
			.getFiles()
			.filter((f) => f.extension === this.ext && f.path.toLowerCase().contains(lower))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 20);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.inputEl.trigger('input');
		this.close();
	}
}
