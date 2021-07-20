type DependencyList = ReadonlyArray<any>;

export interface ContextSelectorMiniHook<Data extends readonly any[]> {
	(): Data;
	<T>(
		fn: (...rootData: Data) => T,
		deps?: DependencyList | null,
		label?: string
	): T;
	<T>(
		fn: (...rootData: Data) => T,
		areDataEqual: (prevValue: T, newValue: T) => boolean,
		deps?: DependencyList | null,
		label?: string
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

export type SubscribeFn<Data extends readonly any[]> = (
	fn: (...data: Data) => void,
	label?: string
) => Unsubscribe;
export interface ContextSubscraberValue<Data extends readonly any[]> {
	id: number;
	getLatestValue: () => Data;
	useUpdateValue: (...value: Data) => void;
	updateValue: (...value: Data) => void;
	subscribe: SubscribeFn<Data>;
	asyncReverseOrderSubscribe: SubscribeFn<Data>;
	destroy: () => void;
	isDestroyed: () => boolean;
}

type Unsubscribe = () => void;
