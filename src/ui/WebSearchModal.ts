// Fallback item picker used when BBT is unavailable (Web API mode).
import { App, FuzzySuggestModal } from 'obsidian';
import { ZoteroManagerSettings } from '../types';
import { WebAPIItem, searchItems } from '../zotero/webAPI';

export class WebSearchModal extends FuzzySuggestModal<WebAPIItem> {
	private settings: ZoteroManagerSettings;
	private items: WebAPIItem[] = [];
	private onSelect: (item: WebAPIItem) => void;

	constructor(app: App, settings: ZoteroManagerSettings, onSelect: (item: WebAPIItem) => void) {
		super(app);
		this.settings = settings;
		this.onSelect = onSelect;
		this.setPlaceholder('Search Zotero library…');
	}

	async onOpen() {
		super.onOpen();
		// Pre-load a default result set
		this.items = await searchItems('', this.settings);
		(this as any).updateSuggestions?.();
	}

	getItems(): WebAPIItem[] {
		return this.items;
	}

	getItemText(item: WebAPIItem): string {
		return `${item.data.title ?? ''} ${item.data.creators?.map((c: any) => c.lastName).join(' ') ?? ''}`;
	}

	onChooseItem(item: WebAPIItem, _evt: MouseEvent | KeyboardEvent): void {
		this.onSelect(item);
	}

	// Live search on input change
	async onInput(query: string) {
		if (query.length < 2) return;
		this.items = await searchItems(query, this.settings);
		(this as any).updateSuggestions?.();
	}
}
