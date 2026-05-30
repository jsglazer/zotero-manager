import nunjucks from 'nunjucks';
import { moment } from 'obsidian';

// ── Persist extension ─────────────────────────────────────────────────────────
// Blocks marked {% persist "key" %}...{% endpersist %} are preserved on re-import.

const PERSIST_START = /\{%-?\s*persist\s+"([^"]+)"\s*-?%\}/g;
const PERSIST_END = /\{%-?\s*endpersist\s*-?%\}/g;
const PERSIST_RENDERED_START = /%%\{persist "([^"]+)"\}%%/g;
const PERSIST_RENDERED_END = /%%\{endpersist\}%%/g;

export class PersistExtension {
	static hasPersist(rendered: string): boolean {
		return PERSIST_RENDERED_START.test(rendered);
	}

	static prepareTemplateData(
		data: Record<string, any>,
		existingContent: string
	): Record<string, any> {
		if (!existingContent) return data;

		const persisted: Record<string, string> = {};
		const lines = existingContent.split('\n');
		let currentKey: string | null = null;
		const buffer: string[] = [];

		for (const line of lines) {
			const startMatch = line.match(/%%\{persist "([^"]+)"\}%%/);
			const endMatch = line.match(/%%\{endpersist\}%%/);
			if (startMatch) {
				currentKey = startMatch[1];
				buffer.length = 0;
			} else if (endMatch && currentKey) {
				persisted[currentKey] = buffer.join('\n');
				currentKey = null;
			} else if (currentKey !== null) {
				buffer.push(line);
			}
		}

		return { ...data, _persisted: persisted };
	}
}

// ── Nunjucks environment ──────────────────────────────────────────────────────

class StringLoader extends nunjucks.Loader {
	getSource(name: string) {
		return { src: name, path: name, noCache: true };
	}
}

const env = new nunjucks.Environment(new StringLoader(), { autoescape: false });

// date filter: {{ date | format("YYYY-MM-DD") }}
env.addFilter('format', (val: any, fmt: string) => {
	if (!val) return '';
	return moment.isMoment(val) ? val.format(fmt) : moment(val).format(fmt);
});

// join filter override to handle arrays of objects
env.addFilter('join', (arr: any[], sep = ', ', attr?: string) => {
	if (!Array.isArray(arr)) return arr;
	const vals = attr ? arr.map((a) => a[attr]) : arr;
	return vals.join(sep);
});

// lower / upper
env.addFilter('lower', (s: string) => (s ?? '').toLowerCase());
env.addFilter('upper', (s: string) => (s ?? '').toUpperCase());

// replace
env.addFilter('replace', (s: string, from: string, to: string) =>
	(s ?? '').split(from).join(to)
);

// truncate
env.addFilter('truncate', (s: string, n: number) =>
	s && s.length > n ? s.slice(0, n) + '…' : s
);

export async function renderTemplate(
	_templatePath: string,
	templateStr: string,
	data: Record<string, any>
): Promise<string> {
	return new Promise((resolve, reject) => {
		env.renderString(templateStr, data, (err, result) => {
			if (err) reject(err);
			else resolve(result ?? '');
		});
	});
}

export { env as nunjucksEnv };
