import type { CSLName, ZoteroCollection, ZoteroItem, ZoteroTag } from '../zotero/data';

// Applies standard field transformations so templates have clean access to
// authors, year, month, etc. without manual parsing.

function processAuthors(item: ZoteroItem): void {
	if (!item.author) return;
	item.authors = item.author;
	item.authorString = item.author
		.map((a: CSLName) => (a.literal ? a.literal : [a.family, a.given].filter(Boolean).join(', ')))
		.join('; ');
	item.firstAuthor = item.author[0] ? (item.author[0].family ?? item.author[0].literal ?? '') : '';
}

function processEditors(item: ZoteroItem): void {
	if (!item.editor) return;
	item.editorString = item.editor
		.map((e: CSLName) => [e.family, e.given].filter(Boolean).join(', '))
		.join('; ');
}

function processDate(item: ZoteroItem): void {
	const parts = item.issued?.['date-parts']?.[0];
	if (!parts?.length) return;
	item.year = parts[0] ? String(parts[0]) : '';
	item.month = parts[1] ? String(parts[1]).padStart(2, '0') : '';
	item.day = parts[2] ? String(parts[2]).padStart(2, '0') : '';
}

function processCollections(item: ZoteroItem): void {
	if (!item.collections?.length) return;
	item.collectionNames = item.collections.map((c: ZoteroCollection) => c.name).join(', ');
	item.collectionPaths = item.collections.map((c: ZoteroCollection) => c.fullPath).join(', ');
}

function processTags(item: ZoteroItem): void {
	if (!item.tags?.length) return;
	item.tagNames = item.tags.map((t: ZoteroTag) => t.tag).join(', ');
	item.hashTags = item.tags.map((t: ZoteroTag) => `#${t.tag.replace(/\s+/g, '-')}`).join(' ');
}

export function applyBasicTemplates(data: ZoteroItem): ZoteroItem {
	processAuthors(data);
	processEditors(data);
	processDate(data);
	processCollections(data);
	processTags(data);
	return data;
}
