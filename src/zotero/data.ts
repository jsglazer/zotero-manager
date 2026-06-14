// Shapes of the Zotero / Better BibTeX JSON-RPC + CSL-JSON payloads the export
// pipeline consumes. These external payloads are dynamic, so we model the fields
// the plugin actually reads or writes. Items are enriched in place with computed
// fields (authorString, year, …) before being handed to user templates, so those
// computed fields are included here as optional. The `[key: string]: unknown`
// index signature keeps any further template-only fields typed as `unknown`
// (safe) rather than `any` (unsafe), without forcing us to enumerate every key a
// user template might reference.

export interface CSLName {
	family?: string;
	given?: string;
	literal?: string;
}

export interface CSLDate {
	'date-parts'?: number[][];
	raw?: string;
}

export interface ZoteroTag {
	tag: string;
}

export interface ZoteroCollection {
	key?: string;
	name?: string;
	fullPath?: string;
	parentCollection?: ZoteroCollection | false;
}

export interface ZoteroAnnotationPosition {
	pageIndex?: number;
	rects?: number[][];
}

export interface ZoteroAnnotation {
	key?: string;
	annotationType?: string;
	annotationColor?: string;
	annotationPageLabel?: string;
	annotationText?: string;
	annotationComment?: string;
	annotationImagePath?: string;
	annotationPosition?: ZoteroAnnotationPosition;
	dateModified?: string;
	tags?: ZoteroTag[];
	[key: string]: unknown;
}

export interface ZoteroAttachment {
	uri?: string;
	path?: string;
	select?: string;
	itemKey?: string;
	desktopURI?: string;
	pdfURI?: string;
	dateAdded?: unknown;
	dateModified?: unknown;
	annotations?: ZoteroAnnotation[];
	[key: string]: unknown;
}

export interface ZoteroNote {
	note?: string;
	uri?: string;
	dateAdded?: unknown;
	dateModified?: unknown;
	desktopURI?: string;
	[key: string]: unknown;
}

// The normalized annotation record the export pipeline builds for templates.
export interface FormattedAnnotation {
	date?: unknown;
	attachment?: unknown;
	id?: string;
	type?: string;
	color?: string;
	colorCategory?: string;
	colorLabel?: string;
	source?: string;
	pageLabel?: string;
	desktopURI?: string;
	page?: number;
	x?: number;
	y?: number;
	annotatedText?: string;
	comment?: string;
	imageBaseName?: string;
	imageRelativePath?: string;
	imageExtension?: string;
	imagePath?: string;
	tags?: ZoteroTag[];
	allTags?: string;
	hashTags?: string;
	[key: string]: unknown;
}

// A CSL-JSON item enriched in place by the export pipeline.
export interface ZoteroItem {
	// identity
	key?: string;
	itemKey?: string;
	uri?: string;
	select?: string;
	libraryID?: number;
	citekey?: string;
	citationKey?: string;
	title?: string;
	// CSL core
	author?: CSLName[];
	editor?: CSLName[];
	issued?: CSLDate;
	// dates (strings from Zotero, replaced by Moment during enrichment)
	dateAdded?: unknown;
	dateModified?: unknown;
	accessDate?: unknown;
	date?: unknown;
	// related data
	collections?: ZoteroCollection[];
	tags?: ZoteroTag[];
	notes?: ZoteroNote[];
	attachments?: ZoteroAttachment[];
	relations?: string[] | Record<string, unknown>;
	// computed / enriched fields added in place
	authors?: CSLName[];
	authorString?: string;
	firstAuthor?: string;
	editorString?: string;
	year?: string;
	month?: string;
	day?: string;
	collectionNames?: string;
	collectionPaths?: string;
	tagNames?: string;
	hashTags?: string;
	importDate?: unknown;
	exportDate?: unknown;
	desktopURI?: string;
	bibliography?: string;
	// any further fields referenced only by user templates
	[key: string]: unknown;
}
