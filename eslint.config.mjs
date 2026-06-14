// Obsidian plugin ESLint flat config (from ~/Dev/devkit).
// typescript-eslint (type-checked) + eslint-plugin-obsidianmd + Prettier compat.
// Lint with: `eslint src`
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
	{
		ignores: [
			'main.js',
			'node_modules/',
			'coverage/',
			'**/*.config.mjs',
			'**/*.config.ts',
		],
	},
	// Brings typescript-eslint base + recommended-type-checked + Obsidian rules.
	...obsidianmd.configs.recommended,
	{
		// obsidianmd enables type-checked rules but leaves project resolution to us.
		files: ['**/*.ts', '**/*.tsx'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// TypeScript already reports undefined identifiers, and `no-undef`
			// misfires on the ambient `app` global (declared in globals.d.ts).
			// Disabling it is the typescript-eslint–recommended setting.
			'no-undef': 'off',

			// --- Advisory (warn), not blocking ---------------------------------
			// This plugin bridges to inherently untyped external data — Zotero /
			// Better BibTeX JSON-RPC, CSL-JSON items, and DOM dataset payloads —
			// plus a handful of Obsidian internal APIs the public types don't
			// cover. The core data model is fully typed in src/zotero/data.ts and
			// the data layer (basicTemplates, annotations, jsonRPC) is strict, but
			// the dynamic boundaries legitimately rely on `any`/`unknown` and
			// unsupported APIs. Keep those advisory so the gate still *blocks* the
			// real-bug-class rules (floating/misused promises, deprecated APIs,
			// unused code, bad assertions) — see ci.yml (lint is now blocking).
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',
			'@typescript-eslint/no-base-to-string': 'warn',
			'@typescript-eslint/restrict-template-expressions': 'warn',
			'@typescript-eslint/restrict-plus-operands': 'warn',
			'no-restricted-globals': 'warn',
			'obsidianmd/no-unsupported-api': 'warn',
			'obsidianmd/prefer-active-doc': 'warn',
			'obsidianmd/prefer-window-timers': 'warn',
			'obsidianmd/prefer-instanceof': 'warn',
			'obsidianmd/detach-leaves': 'warn',
			// UI-convention rules: advisory. sentence-case in particular misfires on
			// domain proper nouns (Juris-M, BibLaTeX, CSL, APA, Better BibTeX), so it
			// must not be auto-enforced; manual-html-headings is purely stylistic.
			'obsidianmd/ui/sentence-case': 'warn',
			'obsidianmd/settings-tab/no-manual-html-headings': 'warn',
		},
	},
	{
		// PluginSettingTab.display() is deprecated since Obsidian 1.13 in favor of
		// the declarative getSettingDefinitions API. Migrating this tab's dynamic
		// settings UI is a separate effort; keep the deprecation advisory here.
		files: ['src/settings/**/*.{ts,tsx}'],
		rules: {
			'@typescript-eslint/no-deprecated': 'warn',
		},
	},
	// Turn off rules that conflict with Prettier — keep this last.
	prettier,
);
