export class Subscription<T extends readonly any[], Meta = {}> {
	private subscribers: {fn: ((...data: T) => void); isCancelled?: true }[];
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

	subscribe = <L extends T = T>(fn: (...data: L) => void): Unsubscribe => {
		this.subscribers.push({ fn });
		return () => {
			this.subscribers = this.subscribers.filter(e => {
				if (e.fn === fn) {
					e.isCancelled = true;
				}
				return e.fn !== fn;
			});
		};
	};

	broadcast = (...data: T) => {
		const arr = this.subscribers;
		for (const el of arr) {
			if (el.isCancelled) continue;
			el.fn(...data);
		}
	};

	clearSubscribers = () => {
		this.subscribers = [];
	};
}

type Unsubscribe = () => void;
