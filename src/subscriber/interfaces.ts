type DependencyList = ReadonlyArray<any>;

export interface ContextSubscriberMiniHook<Data extends readonly any[]> {
	(): Data;
	<T>(fn: (...rootData: Data) => T, deps: DependencyList | null): T;
	<T>(
		fn: (...rootData: Data) => T,
		areDataEqual: (prevValue: T, newValue: T) => boolean,
		deps: DependencyList | null
	): T;
}
export interface ContextSubscriberHook<Data extends readonly any[]>
	extends ContextSubscriberMiniHook<Data> {
	extendHook<T extends readonly any[]>(
		fn: (...rootData: Data) => T
	): ContextSubscriberHook<T>;
}

export interface ContextSubscraberValue<Data extends readonly any[]> {
	id: number;
	getLatestValue: () => Data;
	subscribe: (fn: (...data: Data) => void) => Unsubscribe;
}

type Unsubscribe = () => void;
