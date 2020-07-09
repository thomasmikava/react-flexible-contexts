export class Subscription<T extends readonly any[], Meta = {}> {
	private subscribers: ((...data: T) => void)[];
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
		this.subscribers.push(fn);
		return () => {
			this.subscribers = this.subscribers.filter(e => e !== fn);
		};
	};

	broadcast = (...data: T) => {
		const arr = this.subscribers;
		for (const fn of arr) {
			fn(...data);
		}
	};

	clearSubscribers = () => {
		this.subscribers = [];
	};
}

type Unsubscribe = () => void;
