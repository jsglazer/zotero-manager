import { describe, it, expect } from 'vitest';
import { extractCiteKeys } from '../src/dataview';

describe('extractCiteKeys', () => {
	it('extracts pandoc-style citekeys', () => {
		expect(extractCiteKeys('See [@smith2020] and @jones2021 too.')).toEqual([
			'smith2020',
			'jones2021',
		]);
	});

	it('extracts latex-style citekeys', () => {
		expect(extractCiteKeys('\\cite{smith2020} \\autocite{jones2021,doe2019}')).toEqual([
			'smith2020',
			'jones2021',
			'doe2019',
		]);
	});

	it('ignores @-tokens inside fenced code blocks', () => {
		const content = [
			'Real citation: @smith2020',
			'',
			'```ts',
			'@Component()',
			'const user = "a@example.com";',
			'import pkg from "@types/node";',
			'```',
			'',
			'Another real one: @jones2021',
		].join('\n');
		expect(extractCiteKeys(content)).toEqual(['smith2020', 'jones2021']);
	});

	it('ignores @-tokens inside inline code spans', () => {
		expect(extractCiteKeys('Use the `@app.route` decorator, cites @smith2020 directly.')).toEqual([
			'smith2020',
		]);
	});

	it('handles tilde-fenced code blocks', () => {
		const content = '@smith2020\n~~~\n@notacitekey\n~~~\n@jones2021';
		expect(extractCiteKeys(content)).toEqual(['smith2020', 'jones2021']);
	});
});
