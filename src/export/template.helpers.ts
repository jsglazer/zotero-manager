import { App, TFile, moment, normalizePath } from 'obsidian';
import path from 'path';
import { ExportToMarkdownParams } from '../types';

// ── Export-date tracking ──────────────────────────────────────────────────────

const EXPORT_DATE_MARKER = '%%%ZOTERO_EXPORT_DATE%%%';

export function appendExportDate(content: string): string {
	return `${content}\n${EXPORT_DATE_MARKER}${moment().toISOString()}`;
}

export function getLastExport(content: string): moment.Moment {
	const match = content.match(new RegExp(`${EXPORT_DATE_MARKER}(.+)`));
	return match ? moment(match[1].trim()) : moment(0);
}

// ── Annotation section preservation ──────────────────────────────────────────

const ANNOT_START = '%%%ZOTERO_ANNOTATIONS_START%%%';
const ANNOT_END = '%%%ZOTERO_ANNOTATIONS_END%%%';

export function wrapAnnotationTemplate(content: string): string {
	return `${ANNOT_START}\n${content}\n${ANNOT_END}`;
}

export function getExistingAnnotations(content: string): string {
	const start = content.indexOf(ANNOT_START);
	const end = content.indexOf(ANNOT_END);
	if (start === -1 || end === -1) return '';
	return content.slice(start + ANNOT_START.length, end).trim();
}

// ── Path helpers ──────────────────────────────────────────────────────────────

export function removeStartingSlash(p: string): string {
	return p.startsWith('/') ? p.slice(1) : p;
}

export function replaceIllegalChars(str: string): string {
	return str
		.replace(/\s*[*?]+\s*/g, ' ')
		.trim()
		.replace(/\s*[:"<>|]+\s*/g, ' - ')
		.trim();
}

export function sanitizeFilePath(filePath: string): string {
	const parsed = path.parse(filePath);
	return path.join(
		replaceIllegalChars(parsed.dir),
		`${replaceIllegalChars(parsed.name)}${parsed.ext}`,
	);
}

export async function mkMDDir(app: App, mdPath: string): Promise<void> {
	const dir = normalizePath(path.dirname(mdPath));
	if (dir === '.' || dir === '') return;
	if (!(await app.vault.adapter.exists(dir))) {
		await app.vault.createFolder(dir);
	}
}

// ── Template loading ──────────────────────────────────────────────────────────

async function readTemplate(app: App, tplPath?: string): Promise<string | null> {
	if (!tplPath) return null;
	const file = app.vault.getAbstractFileByPath(normalizePath(tplPath));
	if (!(file instanceof TFile)) return null;
	return app.vault.read(file);
}

export async function getTemplates(
	app: App,
	params: ExportToMarkdownParams,
): Promise<{ template: string | null }> {
	const template = await readTemplate(app, params.exportFormat.templatePath);
	return { template };
}
