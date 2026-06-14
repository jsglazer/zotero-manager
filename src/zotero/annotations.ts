import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { normalizePath } from 'obsidian';
import { moment } from '../moment';
import path from 'path';
import type { FormattedAnnotation, ZoteroAnnotation, ZoteroAttachment, ZoteroTag } from './data';

function hexToHSL(str: string): { h: number; s: number; l: number } {
	let rStr = '0',
		gStr = '0',
		bStr = '0';
	if (str.length === 4) {
		rStr = '0x' + str[1] + str[1];
		gStr = '0x' + str[2] + str[2];
		bStr = '0x' + str[3] + str[3];
	} else if (str.length === 7) {
		rStr = '0x' + str[1] + str[2];
		gStr = '0x' + str[3] + str[4];
		bStr = '0x' + str[5] + str[6];
	}
	const r = +rStr / 255,
		g = +gStr / 255,
		b = +bStr / 255;
	const cmin = Math.min(r, g, b),
		cmax = Math.max(r, g, b),
		delta = cmax - cmin;
	let h = 0,
		s = 0,
		l = 0;
	if (delta !== 0) {
		if (cmax === r) h = ((g - b) / delta) % 6;
		else if (cmax === g) h = (b - r) / delta + 2;
		else h = (r - g) / delta + 4;
	}
	h = Math.round(h * 60);
	if (h < 0) h += 360;
	l = (cmax + cmin) / 2;
	s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	return { h, s: +(s * 100).toFixed(1), l: +(l * 100).toFixed(1) };
}

export function getColorCategory(hex: string): string {
	const { h, s, l } = hexToHSL(hex);
	if (l < 12) return 'Black';
	if (l > 98) return 'White';
	if (s < 2) return 'Gray';
	if (h < 15) return 'Red';
	if (h < 45) return 'Orange';
	if (h < 65) return 'Yellow';
	if (h < 170) return 'Green';
	if (h < 190) return 'Cyan';
	if (h < 255) return 'Blue';
	if (h < 280) return 'Purple';
	if (h < 335) return 'Magenta';
	return 'Red';
}

export function getLocalURI(
	ext: 'select' | 'open-pdf',
	uri: string,
	params?: Record<string, string | undefined>,
): string {
	const itemId = uri.split('/').pop();
	const prefix = `zotero://${ext}`;
	let url = /group/.test(uri)
		? uri.replace('http://zotero.org', prefix)
		: `${prefix}/library/items/${itemId}`;
	if (params) url += `?${new URLSearchParams(params as Record<string, string>)}`;
	return url;
}

export function convertNativeAnnotation(
	annotation: ZoteroAnnotation,
	attachment: ZoteroAttachment,
	imageOutputPath: string,
	imageRelativePath: string,
	imageBaseName: string,
	copy = false,
	colorLabels?: Record<string, string>,
): FormattedAnnotation {
	const colorCategory = getColorCategory(annotation.annotationColor ?? '#000000');
	const annot: FormattedAnnotation = {
		date: moment(annotation.dateModified),
		attachment,
		id: annotation.key,
		type: annotation.annotationType,
		color: annotation.annotationColor,
		colorCategory,
		colorLabel: colorLabels?.[colorCategory] ?? colorCategory,
		source: 'zotero',
	};

	if (attachment.path?.endsWith('.pdf')) {
		annot.pageLabel = annotation.annotationPageLabel;
		annot.desktopURI = getLocalURI('open-pdf', attachment.uri!, {
			page: annotation.annotationPageLabel,
			annotation: annotation.key,
		});
	}

	let page: number | undefined;
	let x: number | undefined;
	let y: number | undefined;
	if (annotation.annotationPosition) {
		if (annotation.annotationPosition.pageIndex !== undefined) {
			page = annotation.annotationPosition.pageIndex + 1;
			annot.page = page;
		}
		if (annotation.annotationPosition.rects) {
			x = annotation.annotationPosition.rects[0][0];
			y = annotation.annotationPosition.rects[0][1];
			annot.x = x;
			annot.y = y;
		}
	}

	if (annotation.annotationText) annot.annotatedText = annotation.annotationText;
	if (annotation.annotationComment) annot.comment = annotation.annotationComment;

	if (annotation.annotationImagePath) {
		const parsed = path.parse(annotation.annotationImagePath);
		const builtName = `${imageBaseName}-${page}-x${Math.round(x ?? 0)}-y${Math.round(y ?? 0)}${parsed.ext}`;
		annot.imageBaseName = builtName;
		annot.imageRelativePath = normalizePath(path.join(imageRelativePath, builtName));
		annot.imageExtension = parsed.ext.slice(1);

		const imagePath = path.join(imageOutputPath, builtName);

		if (copy) {
			if (!existsSync(imageOutputPath)) mkdirSync(imageOutputPath, { recursive: true });
			let input = path.join(parsed.dir, `${annotation.key}${parsed.ext}`);
			if (!existsSync(input)) input = annotation.annotationImagePath;
			try {
				copyFileSync(input, imagePath);
			} catch (e) {
				console.error('Could not copy annotation image:', e);
			}
		}

		annot.imagePath = imagePath;
	}

	if (annotation.tags?.length) {
		annot.tags = annotation.tags;
		annot.allTags = annotation.tags.map((t: ZoteroTag) => t.tag).join(', ');
		annot.hashTags = annotation.tags
			.map((t: ZoteroTag) => `#${t.tag.replace(/\s+/g, '-')}`)
			.join(', ');
	}

	return annot;
}

export function concatAnnotations(annots: FormattedAnnotation[]): FormattedAnnotation[] {
	const output: FormattedAnnotation[] = [];
	const re = /^\+\s*/;
	for (const a of annots) {
		if (typeof a.comment === 'string' && re.test(a.comment)) {
			a.comment = a.comment.replace(re, '');
			const last = output[output.length - 1];
			if (last) {
				last.annotatedText = last.annotatedText
					? last.annotatedText + '...' + String(a.annotatedText)
					: a.annotatedText;
				last.comment = last.comment ? last.comment + '...' + a.comment : a.comment;
				continue;
			}
		}
		output.push(a);
	}
	return output;
}
