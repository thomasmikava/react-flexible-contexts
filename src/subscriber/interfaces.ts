type DependencyList = ReadonlyArray<any>;

export interface ContextSubscriberMiniHook<Data> {
	(): Data;
	<T>(fn: (rootData: Data) => T, deps: DependencyList | null): T;
	<T>(
		fn: (rootData: Data) => T,
		areDataEqual: (prevValue: T, newValue: T) => boolean,
		deps: DependencyList | null
	): T;
}
export interface ContextSubscriberHook<Data>
	extends ContextSubscriberMiniHook<Data> {
	extendHook<T>(fn: (rootData: Data) => T): ContextSubscriberHook<T>;
}

export interface ContextSubscraberValue<Data> {
	id: number;
	getLatestValue: () => Data;
	subscribe: (fn: (data: Data) => void) => Unsubscribe;
}

type Unsubscribe = () => void;
