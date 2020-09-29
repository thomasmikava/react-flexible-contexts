export class Subscription<
	Fn extends (...args: readonly unknown[]) => unknown = () => void,
	Meta = {}
> {
	private subscribers: {
		fn: Fn;
		isCancelled?: true;
		label?: string;
	}[];
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

	subscribe = (fn: Fn, label?: string): Unsubscribe => {
		this.subscribers = [...this.subscribers, { fn, label }];
		return this.getUnsubscribeFn(fn);
	};

	private cSubscribers: {
		fn: Fn;
		isCancelled?: true;
		label?: string;
	}[] = [];
	private planned?: number;

	asyncReverseOrderSubscribe = (fn: Fn, label?: string): Unsubscribe => {
		this.cSubscribers.push({ fn, label });
		if (this.planned) {
			clearTimeout(this.planned);
		}
		this.planned = setTimeout(() => {
			this.subscribers = [
				...this.subscribers,
				...[...this.cSubscribers].reverse(),
			];
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
	};

	broadcast = <Par extends Parameters<Fn>>(
		...data: Par
	): ReturnType<Fn>[] => {
		const arr = this.subscribers;
		const results: ReturnType<Fn>[] = [];
		for (const el of arr) {
			if (el.isCancelled) {
				continue;
			}
			results.push(el.fn(...data) as any);
		}
		this.subscribers = this.subscribers.filter(e => !e.isCancelled);
		return results;
	};

	clearSubscribers = () => {
		this.subscribers = [];
	};
}

type Unsubscribe = () => void;
