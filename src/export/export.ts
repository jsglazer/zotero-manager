import { App, Notice, TFile, moment, normalizePath } from 'obsidian';
import path from 'path';
import { CiteKey, ExportToMarkdownParams, ZoteroManagerSettings } from '../types';
import { getVaultRoot } from '../helpers';
import { getLocalURI } from '../zotero/annotations';
import { convertNativeAnnotation, concatAnnotations } from '../zotero/annotations';
import { getCiteKeys, getCiteKeyFromAny } from '../zotero/cayw';
import {
	getAttachmentsFromCiteKey,
	getBibFromCiteKey,
	getCollectionFromCiteKey,
	getIssueDateFromCiteKey,
	getItemJSONFromCiteKeys,
	getItemJSONFromRelations,
	getNotesFromCiteKeys,
} from '../zotero/jsonRPC';
import { applyBasicTemplates } from './basicTemplates';
import { renderTemplate, PersistExtension } from './template.env';
import {
	appendExportDate,
	getExistingAnnotations,
	getLastExport,
	getTemplates,
	mkMDDir,
	removeStartingSlash,
	sanitizeFilePath,
} from './template.helpers';
import { processZoteroAnnotationNotes } from './exportNotes';
import { htmlToMarkdown } from 'obsidian';

// ── Item data enrichment ──────────────────────────────────────────────────────

async function processNote(
	citeKey: CiteKey,
	note: any,
	importDate: moment.Moment,
	db: import('../types').DatabaseWithPort,
	cslStyle?: string
) {
	if (note.note) {
		note.note = htmlToMarkdown(
			await processZoteroAnnotationNotes(citeKey.key, note.note, {})
		);
	}
	if (note.dateAdded) note.dateAdded = moment(note.dateAdded);
	if (note.dateModified) note.dateModified = moment(note.dateModified);
	note.desktopURI = getLocalURI('select', note.uri);
}

function processAttachment(attachment: any) {
	if (attachment.dateAdded) attachment.dateAdded = moment(attachment.dateAdded);
	if (attachment.dateModified) attachment.dateModified = moment(attachment.dateModified);
	if (attachment.uri) {
		attachment.itemKey = attachment.uri.split('/').pop();
		attachment.desktopURI = attachment.select ?? getLocalURI('select', attachment.uri);
		if (attachment.path?.endsWith('.pdf')) {
			attachment.pdfURI = getLocalURI('open-pdf', attachment.uri);
		}
	}
}

async function processItem(
	item: any,
	importDate: moment.Moment,
	db: import('../types').DatabaseWithPort,
	cslStyle?: string,
	skipRelations = false
) {
	const citekey = getCiteKeyFromAny(item);
	item.importDate = importDate;
	item.exportDate = importDate;
	item.desktopURI = item.select ?? getLocalURI('select', item.uri, item.itemKey);

	if (item.accessDate) item.accessDate = moment(item.accessDate);
	if (item.dateAdded) item.dateAdded = moment(item.dateAdded);
	if (item.dateModified) item.dateModified = moment(item.dateModified);

	if (citekey) {
		if (!item.citekey) item.citekey = citekey.key;
		if (!item.citationKey) item.citationKey = citekey.key;
		try { item.date = await getIssueDateFromCiteKey(citekey, db); } catch { /* ok */ }
		try { item.collections = await getCollectionFromCiteKey(citekey, db); } catch { /* ok */ }
		try {
			item.bibliography = await getBibFromCiteKey(citekey, db, cslStyle);
		} catch {
			item.bibliography = 'Error generating bibliography';
		}
	}

	if (item.notes) {
		for (const note of item.notes) {
			await processNote(citekey!, note, importDate, db, cslStyle);
		}
	}

	if (item.attachments) {
		for (const att of item.attachments) processAttachment(att);
	}

	if (!skipRelations) {
		item.relations = await getRelations(item, item.libraryID, importDate, db, cslStyle);
	}
}

async function getRelations(
	item: any,
	libraryID: number,
	importDate: moment.Moment,
	db: import('../types').DatabaseWithPort,
	cslStyle?: string
): Promise<any[]> {
	if (item.relations && !Array.isArray(item.relations)) {
		const flat: string[] = [];
		for (const val of Object.values(item.relations)) {
			if (Array.isArray(val)) flat.push(...(val as string[]));
		}
		item.relations = flat;
	}
	if (!item.relations?.length) return [];

	const related = await getItemJSONFromRelations(libraryID, item.relations, db);
	for (const r of related) {
		if (getCiteKeyFromAny(r)) await processItem(r, importDate, db, cslStyle, true);
	}
	return related;
}

// ── Export to Markdown ────────────────────────────────────────────────────────

export async function exportToMarkdown(
	app: App,
	params: ExportToMarkdownParams,
	explicitCiteKeys?: CiteKey[]
): Promise<string[]> {
	const { database, exportFormat, settings } = params;
	const importDate = moment();
	const vaultRoot = getVaultRoot(app);

	const citeKeys = explicitCiteKeys ?? (await getCiteKeys(database));
	if (!citeKeys.length) return [];

	const libraryID = citeKeys[0].library;
	const itemData = await getItemJSONFromCiteKeys(citeKeys, database, libraryID);
	if (!itemData) return [];

	for (const item of itemData) {
		await processItem(item, importDate, database, exportFormat.cslStyle);
	}

	const { template } = await getTemplates(app, params);
	if (!template) {
		new Notice(`No template found for export format "${exportFormat.name}"`, 10000);
		return [];
	}

	const sourcePath = exportFormat.templatePath ?? '';
	const createdPaths: string[] = [];

	const toRender: Map<string, { item: any; existingFile: TFile | null; existingContent: string; lastImportDate: moment.Moment; existingAnnotations: string }> = new Map();

	for (const item of itemData) {
		const attachments: any[] = item.attachments ?? [];

		const getMarkdownPath = async (mergedData: any): Promise<string> => {
			const rendered = await renderTemplate(sourcePath, exportFormat.outputPathTemplate, mergedData);
			return normalizePath(sanitizeFilePath(removeStartingSlash(rendered)));
		};

		if (!attachments.length) {
			const pathData = applyBasicTemplates({ annotations: [], ...item });
			const mdPath = await getMarkdownPath(pathData);
			if (!toRender.has(mdPath)) {
				const existingFile = app.vault.getAbstractFileByPath(mdPath) as TFile | null;
				const existingContent = existingFile ? await app.vault.read(existingFile) : '';
				toRender.set(mdPath, {
					item,
					existingFile,
					existingContent,
					lastImportDate: existingFile ? getLastExport(existingContent) : moment(0),
					existingAnnotations: existingFile ? getExistingAnnotations(existingContent) : '',
				});
			}
			continue;
		}

		for (const attachment of attachments) {
			const imageRelativePath = exportFormat.imageOutputPathTemplate
				? normalizePath(sanitizeFilePath(removeStartingSlash(
					await renderTemplate(sourcePath, exportFormat.imageOutputPathTemplate,
						applyBasicTemplates({ annotations: [], ...attachment, ...item }))
				  )))
				: '';

			const imageOutputPath = path.resolve(vaultRoot, imageRelativePath);

			const imageBaseName = exportFormat.imageBaseNameTemplate
				? sanitizeFilePath(removeStartingSlash(
					await renderTemplate(sourcePath, exportFormat.imageBaseNameTemplate,
						applyBasicTemplates({ annotations: [], ...attachment, ...item }))
				  ))
				: 'image';

			// Collect native annotations from BBT attachment data
			const attachmentAnnots: any[] = [];
			const fullAttachments = await getAttachmentsFromCiteKey(
				getCiteKeyFromAny(item)!,
				database
			);

			const attachmentMap = (fullAttachments ?? []).reduce<Record<string, any>>((m, a) => {
				if (a?.path) m[a.path] = a;
				return m;
			}, {});

			const attachmentData = attachmentMap[attachment.path];
			if (attachmentData?.annotations) {
				for (const annot of attachmentData.annotations) {
					attachmentAnnots.push(
						convertNativeAnnotation(annot, attachment, imageOutputPath, imageRelativePath, imageBaseName, true, settings.colorLabels)
					);
				}
			}

			const annots = settings.shouldConcat && attachmentAnnots.length
				? concatAnnotations(attachmentAnnots)
				: attachmentAnnots;

			if (annots.length) attachment.annotations = annots;

			const pathData = applyBasicTemplates({ annotations: annots, ...attachment, ...item });
			const mdPath = await getMarkdownPath(pathData);

			if (!toRender.has(mdPath)) {
				const existingFile = app.vault.getAbstractFileByPath(mdPath) as TFile | null;
				const existingContent = existingFile ? await app.vault.read(existingFile) : '';
				toRender.set(mdPath, {
					item,
					existingFile,
					existingContent,
					lastImportDate: existingFile ? getLastExport(existingContent) : moment(0),
					existingAnnotations: existingFile ? getExistingAnnotations(existingContent) : '',
				});
			}
		}
	}

	for (const [mdPath, data] of toRender.entries()) {
		try {
			const { item, existingFile, existingContent, lastImportDate, existingAnnotations } = data;
			const firstAnnots = (item.attachments ?? []).find((a: any) => a.annotations?.length);
			item.annotations = firstAnnots?.annotations ?? [];
			item.lastImportDate = lastImportDate;
			item.lastExportDate = lastImportDate;
			item.isFirstImport = lastImportDate.valueOf() === 0;

			const templateData = PersistExtension.prepareTemplateData(
				applyBasicTemplates(item),
				existingContent
			);

			let rendered = await renderTemplate(sourcePath, template, templateData);
			if (PersistExtension.hasPersist(rendered)) {
				rendered = appendExportDate(rendered);
			}

			if (existingFile) {
				await app.vault.modify(existingFile, rendered);
			} else {
				await mkMDDir(app, mdPath);
				await app.vault.create(mdPath, rendered);
			}
			createdPaths.push(mdPath);
		} catch (e) {
			new Notice(`Import failed for ${mdPath}: ${(e as Error).message}`, 7000);
			console.error(e);
		}
	}

	return createdPaths;
}

// ── Render citation template ───────────────────────────────────────────────────

export async function renderCiteTemplate(
	app: App,
	params: import('../types').RenderCiteTemplateParams
): Promise<string | null> {
	const { database, format } = params;
	const importDate = moment();
	const citeKeys = await getCiteKeys(database);
	if (!citeKeys.length) return null;

	const libraryID = citeKeys[0].library;
	const itemData = await getItemJSONFromCiteKeys(citeKeys, database, libraryID);
	if (!itemData?.length) return null;

	const output: string[] = [];
	for (const item of itemData) {
		await processItem(item, importDate, database, format.cslStyle);
		const attachments: any[] = item.attachments ?? [];
		const firstAnnots = attachments.find((a: any) => a.annotations?.length);
		const templateData = applyBasicTemplates({
			attachment: firstAnnots ?? (attachments.length ? attachments[0] : null),
			...item,
		});
		output.push(await renderTemplate('', format.template!, templateData));
	}
	return output.join(' ');
}

// ── Data explorer ─────────────────────────────────────────────────────────────

export async function dataExplorerPrompt(
	app: App,
	settings: ZoteroManagerSettings
): Promise<any[] | null> {
	const database = { database: settings.database, port: settings.port };
	const importDate = moment();
	const citeKeys = await getCiteKeys(database);
	if (!citeKeys.length) return null;

	const libraryID = citeKeys[0].library;
	const itemData = await getItemJSONFromCiteKeys(citeKeys, database, libraryID);
	if (!itemData) return null;

	for (const item of itemData) {
		await processItem(item, importDate, database);

		const fullAttachments = await getAttachmentsFromCiteKey(getCiteKeyFromAny(item)!, database);
		const attachmentMap = (fullAttachments ?? []).reduce<Record<string, any>>((m, a) => {
			if (a?.path) m[a.path] = a;
			return m;
		}, {});

		for (const attachment of item.attachments ?? []) {
			const attachmentData = attachmentMap[attachment.path];
			if (attachmentData?.annotations) {
				attachment.annotations = attachmentData.annotations.map((annot: any) =>
					convertNativeAnnotation(annot, attachment, '/output_path', 'output_path', 'base_name')
				);
			}
		}

		applyBasicTemplates(item);
	}

	return itemData;
}
