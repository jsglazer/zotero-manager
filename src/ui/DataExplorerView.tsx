import { ItemView, WorkspaceLeaf } from 'obsidian';
import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import type ZoteroManager from '../main';

export const DATA_EXPLORER_VIEW = 'zotero-manager-data-explorer';

function JsonTree({ data, depth = 0 }: { data: any; depth?: number }) {
	const [open, setOpen] = useState(depth < 2);

	if (data === null) return <span style={{ color: 'var(--text-muted)' }}>null</span>;
	if (typeof data !== 'object') {
		const color =
			typeof data === 'string'
				? 'var(--color-green)'
				: typeof data === 'number'
				? 'var(--color-blue)'
				: 'var(--color-orange)';
		return <span style={{ color }}>{JSON.stringify(data)}</span>;
	}

	const isArray = Array.isArray(data);
	const keys = Object.keys(data);
	const bracket = isArray ? ['[', ']'] : ['{', '}'];

	return (
		<span>
			<span
				style={{ cursor: 'pointer', userSelect: 'none' }}
				onClick={() => setOpen((o) => !o)}
			>
				{open ? '▾' : '▸'} {bracket[0]}
			</span>
			{open ? (
				<div style={{ paddingLeft: '1em' }}>
					{keys.map((k) => (
						<div key={k}>
							<span style={{ color: 'var(--text-accent)' }}>{isArray ? k : `"${k}"`}</span>:{' '}
							<JsonTree data={data[k]} depth={depth + 1} />
						</div>
					))}
				</div>
			) : (
				<span style={{ color: 'var(--text-muted)' }}> …{keys.length} items </span>
			)}
			{bracket[1]}
		</span>
	);
}

function DataExplorerApp({ plugin }: { plugin: ZoteroManager }) {
	const [data, setData] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		setLoading(true);
		setError(null);
		try {
			const { dataExplorerPrompt } = await import('../export/export');
			const result = await dataExplorerPrompt(plugin.app, plugin.settings);
			setData(result);
		} catch (e) {
			setError((e as Error).message);
		}
		setLoading(false);
	};

	return (
		<div class="zotero-manager-data-explorer">
			<button onClick={() => void load()} disabled={loading}>
				{loading ? 'Loading…' : 'Select item from Zotero'}
			</button>
			{error && <p style={{ color: 'var(--color-red)' }}>{error}</p>}
			{data && <JsonTree data={data} />}
		</div>
	);
}

export class DataExplorerView extends ItemView {
	private plugin: ZoteroManager;

	constructor(leaf: WorkspaceLeaf, plugin: ZoteroManager) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return DATA_EXPLORER_VIEW; }
	getDisplayText() { return 'Zotero Data Explorer'; }
	getIcon() { return 'book-open'; }

	async onOpen() {
		render(<DataExplorerApp plugin={this.plugin} />, this.contentEl);
	}

	async onClose() {
		render(null, this.contentEl);
	}
}
