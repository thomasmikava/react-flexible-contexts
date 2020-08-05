type DependencyList = ReadonlyArray<any>;

export interface ContextSelectorMiniHook<Data extends readonly any[]> {
	(): Data;
	<T>(fn: (...rootData: Data) => T, deps: DependencyList | null): T;
	<T>(
		fn: (...rootData: Data) => T,
		areDataEqual: (prevValue: T, newValue: T) => boolean,
		deps: DependencyList | null
	): T;
}
export interface ContextSelectorHook<Data extends readonly any[]>
	extends ContextSelectorMiniHook<Data> {
	extendHook<T extends readonly any[]>(
		fn: (...rootData: Data) => T
	): ContextSelectorHook<T>;
	setEqualityFn(equalityFn: (prevValue: any, newValue: any) => boolean): void;
	getEqualityFnInfo: () => {
		isDefaultFn: boolean;
		fn: (prevValue: any, newValue: any) => boolean;
	};
}

export interface ContextSubscraberValue<Data extends readonly any[]> {
	id: number;
	getLatestValue: () => Data;
	subscribe: (fn: (...data: Data) => void) => Unsubscribe;
}

type Unsubscribe = () => void;
