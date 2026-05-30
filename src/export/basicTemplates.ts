import { moment } from 'obsidian';

// Applies standard field transformations so templates have clean access to
// authors, year, month, etc. without manual parsing.

function processAuthors(item: any): void {
	if (!item.author) return;
	item.authors = item.author;
	item.authorString = item.author
		.map((a: any) =>
			a.literal
				? a.literal
				: [a.family, a.given].filter(Boolean).join(', ')
		)
		.join('; ');
	item.firstAuthor = item.author[0]
		? item.author[0].family ?? item.author[0].literal ?? ''
		: '';
}

function processEditors(item: any): void {
	if (!item.editor) return;
	item.editorString = item.editor
		.map((e: any) => [e.family, e.given].filter(Boolean).join(', '))
		.join('; ');
}

function processDate(item: any): void {
	if (!item.issued?.['date-parts']?.[0]?.length) return;
	const parts = item.issued['date-parts'][0];
	item.year = parts[0] ? String(parts[0]) : '';
	item.month = parts[1] ? String(parts[1]).padStart(2, '0') : '';
	item.day = parts[2] ? String(parts[2]).padStart(2, '0') : '';
}

function processCollections(item: any): void {
	if (!item.collections?.length) return;
	item.collectionNames = item.collections.map((c: any) => c.name).join(', ');
	item.collectionPaths = item.collections.map((c: any) => c.fullPath).join(', ');
}

function processTags(item: any): void {
	if (!item.tags?.length) return;
	item.tagNames = item.tags.map((t: any) => t.tag).join(', ');
	item.hashTags = item.tags
		.map((t: any) => `#${t.tag.replace(/\s+/g, '-')}`)
		.join(' ');
}

export function applyBasicTemplates(data: Record<string, any>): Record<string, any> {
	processAuthors(data);
	processEditors(data);
	processDate(data);
	processCollections(data);
	processTags(data);
	return data;
}
