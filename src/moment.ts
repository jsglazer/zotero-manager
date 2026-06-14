// Obsidian provides moment() at runtime, but its published type declares the
// `moment` export as a non-callable namespace (`typeof Moment`), which TypeScript 6
// rejects at every call site ("This expression is not callable"). Re-type it to
// moment's own callable signature. `typeof import('moment')` is type-only (erased
// at build), so this does NOT bundle moment — calls still use the instance
// Obsidian provides (obsidian stays an esbuild external).
import { moment as obsidianMoment } from 'obsidian';

export const moment = obsidianMoment as unknown as typeof import('moment');
export type Moment = import('moment').Moment;
