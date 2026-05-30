// Serial request queue — prevents concurrent BBT HTTP calls from racing.
type Resolve = () => void;

const queue: Array<{ id: symbol; resolve: Resolve }> = [];
let running: symbol | null = null;

export const ZQueue = {
	wait(id: symbol): Promise<void> {
		return new Promise((resolve) => {
			queue.push({ id, resolve });
			if (queue.length === 1) this._next();
		});
	},

	end(id: symbol) {
		if (running === id) {
			running = null;
			this._next();
		}
	},

	_next() {
		if (queue.length === 0) return;
		const item = queue.shift()!;
		running = item.id;
		item.resolve();
	},
};
