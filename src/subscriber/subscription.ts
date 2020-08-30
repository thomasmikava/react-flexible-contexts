export class Subscription<T extends readonly any[], Meta = {}> {
	private subscribers: {fn: ((...data: T) => void); isCancelled?: true; label?: string }[];
	private metaData: Meta;

	constructor(defaultMetaData?: Meta) {
		if (defaultMetaData !== undefined) {
			this.metaData = defaultMetaData;
		}
		this.subscribers = [];
	}

	setMetaData = (metaData: Meta) => {
		this.metaData = metaData;
	};

	getMetaData = () => {
		if (this.metaData === undefined) {
			throw new Error("meta data not set");
		}
		return this.metaData;
	};

	subscribe = <L extends T = T>(fn: (...data: L) => void, label?: string): Unsubscribe => {
		this.subscribers = [...this.subscribers, { fn, label }];
		return this.getUnsubscribeFn(fn);
	};

	private cSubscribers: {fn: ((...data: T) => void); isCancelled?: true; label?: string }[] = [];
	private planned?: number;

	asyncReverseOrderSubscribe = <L extends T = T>(fn: (...data: L) => void, label?: string): Unsubscribe => {
		this.cSubscribers.push({ fn, label });
		if (this.planned) {
			clearTimeout(this.planned);
		}
		this.planned = setTimeout(() => {
			this.subscribers = [...this.subscribers, ...[...this.cSubscribers].reverse()];
			this.cSubscribers = [];
		}, 0);
		return this.getUnsubscribeFn(fn);
	};

	private getUnsubscribeFn = (fn: () => void) => {
		return () => {
			this.subscribers = this.subscribers.filter(e => {
				if (e.isCancelled || e.fn === fn) {
					e.isCancelled = true;
					return false;
				}
				return true;
			});
		};
	}

	broadcast = (...data: T) => {
		const arr = this.subscribers;
		for (const el of arr) {
			if (el.isCancelled) {
				continue;
			}
			el.fn(...data);
		}
		this.subscribers = this.subscribers.filter(e => !e.isCancelled);
	};

	clearSubscribers = () => {
		this.subscribers = [];
	};
}

type Unsubscribe = () => void;
