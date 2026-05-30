import { App, Modal } from 'obsidian';

export class LoadingModal extends Modal {
	private message: string;

	constructor(app: App, message: string) {
		super(app);
		this.message = message;
	}

	onOpen() {
		this.contentEl.createEl('p', { text: this.message });
	}

	onClose() {
		this.contentEl.empty();
	}
}
