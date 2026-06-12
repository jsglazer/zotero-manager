import { copyFileSync, existsSync, mkdirSync } from 'fs';
import {
	App,
	Editor,
	Modal,
	Notice,
	Setting,
	TFile,
	TFolder,
	htmlToMarkdown,
	moment,
	normalizePath,
} from 'obsidian';
import path from 'path';
import { CiteKey, DatabaseWithPort } from '../types';
import { getVaultRoot } from '../helpers';
import { convertNativeAnnotation, getColorCategory, getLocalURI } from '../zotero/annotations';
import { getCiteKeys } from '../zotero/cayw';
import { getAttachmentsFromCiteKey, getNotesFromCiteKeys } from '../zotero/jsonRPC';
import { mkMDDir, removeStartingSlash, sanitizeFilePath } from './template.helpers';

// ── HTML note processing ──────────────────────────────────────────────────────

export async function processZoteroAnnotationNotes(
	key: string,
	noteStr: string,
	attachments: Record<string, string>,
	destination?: string,
): Promise<string> {
	const parsed = new DOMParser().parseFromString(noteStr, 'text/html');
	const annots = parsed.querySelectorAll('[data-annotation]');
	const cites = parsed.querySelectorAll('[data-citation]');

	for (const annot of Array.from(annots)) {
		try {
			const params = (annot as HTMLElement).dataset.annotation;
			const json = params ? JSON.parse(decodeURIComponent(params)) : null;
			if (!json) continue;

			const isImage = annot instanceof HTMLImageElement;
			if (isImage) {
				const imagePath = attachments[json.annotationKey];
				if (imagePath) {
					const destPath = await getAvailablePathForAttachments(
						json.annotationKey,
						path.extname(imagePath).slice(1),
						destination,
					);
					const output = path.parse(path.join(getVaultRoot(app), destPath));
					if (!existsSync(output.dir)) mkdirSync(output.dir, { recursive: true });

					const parsed2 = path.parse(imagePath);
					let input = path.join(parsed2.dir, `${json.annotationKey}${parsed2.ext}`);
					if (!existsSync(input)) input = imagePath;
					try {
						copyFileSync(input, path.join(getVaultRoot(app), destPath));
					} catch (e) {
						new Notice('Error: unable to copy annotation image from Zotero into your vault', 7000);
					}
					(annot as HTMLImageElement).src = destPath;
				}
			}

			const linkEl = document.createElement('a');
			linkEl.textContent = 'Go to annotation';
			linkEl.href = getLocalURI('open-pdf', json.attachmentURI, {
				page: json.pageLabel,
				annotation: json.annotationKey,
			});

			if (isImage) {
				annot.insertAdjacentElement('afterend', linkEl);
				annot.insertAdjacentElement('afterend', document.createElement('br'));
			} else {
				annot.insertAdjacentElement('beforebegin', linkEl);
				const sp = document.createElement('span');
				sp.textContent = ' ';
				annot.insertAdjacentElement('beforebegin', sp);
			}
		} catch (e) {
			console.error(e);
		}
	}

	for (const cite of Array.from(cites)) {
		try {
			const params = (cite as HTMLElement).dataset.citation;
			const json = params ? JSON.parse(decodeURIComponent(params)) : null;
			if (!json?.citationItems?.[0]?.uris?.[0]) continue;

			const citeSpan = cite.querySelector('span');
			if (!citeSpan) continue;

			const text = citeSpan.textContent ?? '';
			citeSpan.innerHTML = '';
			const a = document.createElement('a');
			a.textContent = text;
			a.href = getLocalURI('select', json.citationItems[0].uris[0]);
			citeSpan.appendChild(a);
		} catch (e) {
			console.error(e);
		}
	}

	return parsed.body.innerHTML;
}

async function getAvailablePathForAttachments(
	base: string,
	extension: string,
	destination?: string,
): Promise<string> {
	let folderPath: string = (app.vault as any).getConfig('attachmentFolderPath') ?? '';
	const sameFolder = folderPath === '.' || folderPath === './';
	let subfolder: string | null = null;
	if (folderPath.startsWith('./')) subfolder = folderPath.slice(2);

	if (sameFolder) {
		folderPath = destination ?? '';
	} else if (subfolder) {
		folderPath = path.join(destination ?? '', subfolder);
	}

	folderPath = normalizePath(folderPath);
	const folder = (app.vault as any).getAbstractFileByPathInsensitive(folderPath);

	if (!folder && subfolder) {
		await app.vault.createFolder(folderPath);
	}

	if (!(folder instanceof TFolder)) return `${base}.${extension}`;
	return `${(folder as any).getParentPrefix?.() ?? ''}${base}.${extension}`;
}

// ── Native annotation formatter ───────────────────────────────────────────────

function formatNativeAnnotation(
	annot: any,
	attachment: any,
	colorLabels?: Record<string, string>,
): string {
	const colorCategory = getColorCategory(annot.annotationColor ?? '#ffff00');
	const color = colorLabels?.[colorCategory] ?? colorCategory;
	const page = annot.annotationPageLabel ?? '';
	const uri = attachment.uri
		? getLocalURI('open-pdf', attachment.uri, { page, annotation: annot.key })
		: '';
	const link = uri ? `[Go to annotation](${uri})` : '';
	const pageStr = page ? ` — p. ${page}` : '';

	const lines: string[] = [];

	switch (annot.annotationType) {
		case 'highlight':
		case 'underline': {
			lines.push(`## ${color}${pageStr}`);
			const parts: string[] = [];
			if (annot.annotationText) parts.push(annot.annotationText);
			if (annot.annotationComment) parts.push(annot.annotationComment);
			if (parts.length === 1) {
				lines.push(parts[0]);
			} else if (parts.length > 1) {
				lines.push(parts.map((p) => `- ${p}`).join('\n'));
			}
			break;
		}
		case 'note': {
			lines.push(`## Note${pageStr}`);
			if (annot.annotationComment) lines.push(annot.annotationComment);
			break;
		}
		case 'image': {
			lines.push(`## Image${pageStr}`);
			if (annot.annotationComment) lines.push(annot.annotationComment);
			break;
		}
		default: {
			lines.push(`## Annotation${pageStr}`);
			if (annot.annotationComment) lines.push(annot.annotationComment);
		}
	}

	if (link) lines.push(link);
	return lines.join('\n\n');
}

// ── Note export prompt ────────────────────────────────────────────────────────

export async function noteExportPrompt(
	db: DatabaseWithPort,
	destination?: string,
	colorLabels?: Record<string, string>,
): Promise<Record<string, string> | undefined> {
	const citeKeys = await getCiteKeys(db);
	if (!citeKeys.length) return;

	const notes = (await getNotesFromCiteKeys(citeKeys, db)) ?? {};
	const keys = Object.keys(notes);

	// Collect attachments for each cite key (images for note processing + native annotations)
	const imageMap: Record<string, Record<string, string>> = {};
	const nativeAnnotsMap: Record<string, string> = {};

	for (const ck of citeKeys) {
		const atts = await getAttachmentsFromCiteKey(ck, db);
		if (!atts) continue;

		const images: Record<string, string> = {};
		const annotLines: string[] = [];

		for (const a of atts) {
			if (!a.annotations?.length) continue;
			for (const annot of a.annotations) {
				if (annot.annotationType === 'image') {
					images[annot.key] = annot.annotationImagePath;
				}
				annotLines.push(formatNativeAnnotation(annot, a, colorLabels));
			}
		}

		imageMap[ck.key] = images;
		if (annotLines.length) nativeAnnotsMap[ck.key] = annotLines.join('\n\n');
	}

	const notesMarkdown: Record<string, string> = {};
	for (const key of keys) {
		const parts: string[] = [];

		// Text notes (from Zotero note editor)
		for (const note of notes[key]) {
			parts.push(
				htmlToMarkdown(
					await processZoteroAnnotationNotes(key, note, imageMap[key] ?? {}, destination),
				),
			);
		}

		// Native PDF annotations (highlights, underlines, comments)
		if (nativeAnnotsMap[key]) {
			parts.push('## Annotations\n\n' + nativeAnnotsMap[key]);
		}

		notesMarkdown[key] = parts.filter(Boolean).join('\n\n');
	}

	// If there were no text notes but there ARE native annotations, still return them
	for (const ck of citeKeys) {
		if (!notesMarkdown[ck.key] && nativeAnnotsMap[ck.key]) {
			notesMarkdown[ck.key] = '## Annotations\n\n' + nativeAnnotsMap[ck.key];
		}
	}

	if (!Object.keys(notesMarkdown).length) {
		new Notice('No notes or annotations found for selected items', 7000);
		return;
	}

	return notesMarkdown;
}

// ── Insert / import ───────────────────────────────────────────────────────────

export function insertNotesIntoCurrentDoc(editor: Editor, notes: Record<string, string>): void {
	editor.replaceSelection(Object.values(notes).join('\n\n'));
}

export async function filesFromNotes(
	app: App,
	folder: string,
	notes: Record<string, string>,
): Promise<Array<{ path: string; citekey: string }>> {
	const results: Array<{ path: string; citekey: string }> = [];
	for (const [citekey, content] of Object.entries(notes)) {
		const file = await newNoteFile(app, folder, citekey, content);
		if (!file) break;
		results.push({ path: file.path, citekey });
	}
	return results;
}

class ConfirmOverwriteModal extends Modal {
	private message: string;
	private resolve: (confirmed: boolean) => void;

	constructor(app: App, filePath: string, resolve: (confirmed: boolean) => void) {
		super(app);
		this.message = `"${filePath}" already exists. Overwrite it?`;
		this.resolve = resolve;
	}

	onOpen() {
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((btn) =>
				btn
					.setButtonText('Overwrite')
					.setCta()
					.onClick(() => {
						this.resolve(true);
						this.close();
					}),
			)
			.addButton((btn) =>
				btn.setButtonText('Cancel').onClick(() => {
					this.resolve(false);
					this.close();
				}),
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

function confirmOverwrite(app: App, filePath: string): Promise<boolean> {
	return new Promise((resolve) => new ConfirmOverwriteModal(app, filePath, resolve).open());
}

async function newNoteFile(
	app: App,
	folder: string,
	citeKey: string,
	content: string,
): Promise<TFile | null> {
	const filePath = normalizePath(sanitizeFilePath(removeStartingSlash(`${folder}/${citeKey}.md`)));
	let file = app.vault.getAbstractFileByPath(filePath) as TFile | null;
	try {
		if (file) {
			const confirmed = await confirmOverwrite(app, filePath);
			if (!confirmed) return null;
			await app.vault.modify(file, content);
		} else {
			await mkMDDir(app, filePath);
			file = await app.vault.create(filePath, content);
		}
	} catch (e) {
		new Notice(`Error creating file "${filePath}": ${(e as Error).message}`, 10000);
		return null;
	}
	return file;
}
