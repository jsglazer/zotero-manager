import { describe, it, expect } from 'vitest';
import { padNumber } from '../src/helpers';

describe('padNumber', () => {
	it('pads single digits with a leading zero', () => {
		expect(padNumber(5)).toBe('05');
	});

	it('leaves two-digit numbers unchanged', () => {
		expect(padNumber(12)).toBe('12');
	});
});
