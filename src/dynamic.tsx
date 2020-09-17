import React, { useContext, useRef, useState, useEffect } from "react";
import { ContextSubscriber } from "./subscriber";
import { ContextSelectorHook } from "./subscriber/interfaces";
import { usePropsMemo } from "./hooks";
import { Subscription } from "./subscriber/subscription";
import { useReRenderSubscription } from "./subscriber/re-render";
import { areDeeplyEqual } from "./equality-functions";
import { dublicateEqualityFn } from "./subscriber/hook";

const EMPTY_VAL = `__$$emptyValue:?#@#y7q!}fmhW)eL}L{b#b^(3$ZAMg.eyp6NL#h<N-S$)L<.=-j3WsMp&%2JDf6_vVdN7K."pg"_aswq"9CRS?!9YzG[}AD~Xb[E__$$`;

export class DynamicContext<
	RawValue extends any,
	Key extends string | null,
	Value = RawValue,
	ContextSelectorArgs extends readonly any[] = DefSelectorArgs<
		Value,
		RawValue
	>
> {
	private readonly RawProvider: MinimalComponent<any>;
	private rawToFinalValueHook: (data: RawValue) => Value;
	private subscriberContext: ContextSubscriber<ContextSelectorArgs>;
	private readonly mainContext: React.Context<RawValue>;

	readonly useSelector: ContextSelectorHook<ContextSelectorArgs>;
	private readonly selectorArgsHook: (
		value: Value,
		rawValue: RawValue
	) => ContextSelectorArgs;

	private InternalHooks = {
		version: 0,
		arr: [] as HookInfo<Value, any>[],
	};

	private constructor(
		private defaultValueGetter: () => RawValue,
		private readonly key?: Key,
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	) {
		if (key === "undefined") {
			key = "value" as Key;
			this.key = key;
		}
		this.mainContext = React.createContext<RawValue>(EMPTY_VAL as any);
		this.defaultValueGetter = defaultValueGetter;
		const rawToFinalValueHook = options
			? options.rawToFinalValueHook
			: undefined;
		this.rawToFinalValueHook =
			rawToFinalValueHook || ((x: RawValue) => (x as any) as Value);
		this.RawProvider = this.getRawProvider();
		let selectorArgsEqualityFn = options
			? options.selectorArgsEqualityFn
			: undefined;
		const selectorValueEqualityFn =
			options && options.selectorValueEqualityFn;
		const selectorArgsHook = options ? options.selectorArgsHook : undefined;
		if (!selectorArgsHook) {
			selectorArgsEqualityFn = defaultContextSelectorArgsEqualityFn;
		}
		this.selectorArgsHook =
			selectorArgsHook || (defaultUseContextSelectorArgs as any);
		this.subscriberContext = new ContextSubscriber<ContextSelectorArgs>(
			this.getSubscriberContextDefaultValue,
			selectorArgsEqualityFn
		);
		this.useSelector = this.subscriberContext.useSelector;
		if (selectorValueEqualityFn) {
			this.useSelector.setEqualityFn(selectorValueEqualityFn);
		}
	}

	private getSubscriberContextDefaultValue = () => {
		const rawValue = this.useRawValue();
		const finalValue = this.rawToFinalValueHook(rawValue);
		return this.selectorArgsHook(finalValue, rawValue);
	};

	private defValueReRenders = new Subscription();

	setContextName(name: string | undefined) {
		this.mainContext.displayName = name;
	}

	setDefaultValue(rawValue: RawValue) {
		this.defaultValueGetter = () => rawValue;
		this.subscriberContext.setDefaultValueGetter(() =>
			this.getSubscriberContextDefaultValue()
		);
		this.defValueReRenders.broadcast();
	}

	setDefaultValueGetter(fn: () => RawValue) {
		this.defaultValueGetter = fn;
		this.subscriberContext.setDefaultValueGetter(() =>
			this.getSubscriberContextDefaultValue()
		);
		this.defValueReRenders.broadcast();
	}

	useRawValue = (): RawValue => {
		let contextValue = useContext(this.mainContext);
		if (contextValue === EMPTY_VAL) {
			useReRenderSubscription(this.defValueReRenders);
			contextValue = this.defaultValueGetter();
		}
		if (contextValue === EMPTY_VAL) {
			throw new Error(
				"Dynamic Context without deafult value must be used with provider"
			);
		}
		return contextValue;
	};

	Provider: MinimalComponent<
		Key extends string ? Record<Key, RawValue> : RawValue
	> = (props: any) => {
		const Provider = this.providerHelper;
		return <Provider {...props} key={this.InternalHooks.version} />;
	};

	private providerHelper: MinimalComponent<
		Key extends string ? Record<Key, RawValue> : RawValue
	> = ({ children, ...props }: any) => {
		const [internalContextData] = useState(
			this.subscriberContext.registerNewProvider
		);
		useEffect(() => {
			return () =>
				this.subscriberContext.destroyIntervalProvider(
					internalContextData.id
				);
		}, []);
		const RawProvider = this.RawProvider;
		const rawValue = this.useReconstructValue(props);
		const finalValue = this.rawToFinalValueHook(rawValue);
		const contextSelectorArgs = this.selectorArgsHook(finalValue, rawValue);
		this.subscriberContext.updateLastProviderValue(
			internalContextData.id,
			...contextSelectorArgs
		);
		let lastChildren = children;
		for (const el of this.InternalHooks.arr) {
			const Provider = el.dynamicContext.Provider;
			const val = el.hook(finalValue);
			lastChildren = <Provider value={val}>{lastChildren}</Provider>;
		}
		const Int = this.subscriberContext.context.Provider;
		return (
			<Int value={internalContextData}>
				<RawProvider {...props}>{lastChildren}</RawProvider>
			</Int>
		);
	};

	private useReconstructValue(props: any): RawValue {
		if (typeof this.key === "string") {
			return props[this.key];
		}
		return usePropsMemo(() => props, [props]);
	}

	addInternalContext<Hook extends (value: Value) => any>(
		hook: Hook,
		displayName?: string
	): DynamicContext<ReturnType<Hook>, "value"> & { destroy: Destroy } {
		type R = ReturnType<Hook>;
		this.InternalHooks.version++;
		const valueGetter = () => (hook(this.useValue()) as any) as R;

		const selectorValueEqualityFn = dublicateEqualityFn(this.useSelector);

		const dynamicContext = new DynamicContext(valueGetter, "value", {
			selectorValueEqualityFn,
		}) as DynamicContext<ReturnType<Hook>, "value"> & { destroy: Destroy };
		dynamicContext.setContextName(displayName);
		const el: HookInfo<Value, R> = {
			hook,
			dynamicContext,
		};
		this.InternalHooks.arr.unshift(el);
		const destroy = () => {
			const index = this.InternalHooks.arr.indexOf(el);
			if (index === -1) return;
			this.InternalHooks.version++;
			this.InternalHooks.arr.splice(index, 1);
		};
		dynamicContext.destroy = destroy;
		return dynamicContext;
	}

	private getRawProvider(): MinimalComponent<any> {
		const RawContextProvider = this.mainContext.Provider;
		if (this.key === "value") return RawContextProvider;

		if (typeof this.key === "string") {
			const Provider: React.FC<Record<string, RawValue>> = props => {
				const value = props[this.key as any] as RawValue;
				const children = props.children;
				return (
					<RawContextProvider value={value}>
						{children}
					</RawContextProvider>
				);
			};
			return Provider;
		}

		const Provider = DynamicContext.createDestructuredProvider(
			this.mainContext as any
		);
		return Provider;
	}

	useValue = (): Value => {
		const rawValue = this.useRawValue();
		return this.rawToFinalValueHook(rawValue);
	};

	useProperty = <
		K extends Value extends Record<any, any> ? keyof Value : never
	>(
		key: K
	): Value extends Record<any, any> ? Value[K] : never => {
		return this.useSelector((val => val[key]) as any, []);
	};
	useProperties = <
		K extends Value extends Record<any, any> ? keyof Value : never
	>(
		...keys: K[]
	): Value extends Record<any, any> ? Pick<Value, K> : never => {
		return this.useSelector(
			(val => pickKeys(val, keys)) as any,
			topPropsEquality,
			[]
		);
	};

	static create<
		RawValue extends any,
		K extends string | null,
		Value = RawValue,
		ContextSelectorArgs extends readonly any[] = [Value, () => RawValue]
	>(
		defaultValue: RawValue | undefined,
		key: K,
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	): DynamicContext<RawValue, K, Value>;
	static create<
		RawValue extends any,
		Value = RawValue,
		ContextSelectorArgs extends readonly any[] = [Value, () => RawValue]
	>(
		defaultValue?: RawValue,
		key?: undefined | "value",
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	): DynamicContext<RawValue, "value", Value>;
	static create<RawValue extends any, Value = RawValue>(
		defaultValue?: RawValue,
		key = "value",
		options?: any
	): any {
		const valueGetter = () =>
			((defaultValue === undefined
				? EMPTY_VAL
				: defaultValue) as any) as RawValue;
		return new DynamicContext<RawValue, any, Value>(
			valueGetter,
			key,
			options
		);
	}

	static createDestructured<
		RawValue extends Record<any, any>,
		Value = RawValue,
		ContextSelectorArgs extends readonly any[] = [Value, () => RawValue]
	>(
		defaultValue?: RawValue,
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	): DynamicContext<RawValue, null, Value, ContextSelectorArgs> {
		const valueGetter = () =>
			((defaultValue === undefined
				? EMPTY_VAL
				: defaultValue) as any) as RawValue;

		return new DynamicContext<RawValue, null, Value, ContextSelectorArgs>(
			valueGetter,
			null,
			options
		);
	}

	private static createDestructuredProvider<Value extends {}>(
		RawContext: React.Context<Value>
	): MinimalComponent<Value> {
		const Provider: React.FC<Value> = ({ children, ...rest }) => {
			const oldValueRef = useRef(rest);
			const newVal = areEqual(oldValueRef.current, rest)
				? oldValueRef.current
				: rest;
			if (newVal !== oldValueRef.current) {
				oldValueRef.current = newVal;
			}
			return (
				<RawContext.Provider value={newVal as Value}>
					{children}
				</RawContext.Provider>
			);
		};
		return Provider;
	}
}

const areEqual = (obj1: object, obj2: object): boolean => {
	if (obj1 === obj2) return true;
	const obj1Keys = Object.keys(obj1);
	const obj2Keys = Object.keys(obj2);
	if (obj1Keys.length !== obj2Keys.length) return false;
	for (let i = 0; i < obj1Keys.length; i++) {
		if (
			obj1Keys[i] !== obj2Keys[i] ||
			obj1[obj1Keys[i]] !== obj2[obj2Keys[i]]
		) {
			return false;
		}
	}
	return true;
};

export interface MinimalComponent<P = {}> {
	(props: P & { children?: React.ReactNode }): React.ReactElement | null;
}

interface HookInfo<Value extends any, R extends any> {
	hook: (value: Value) => R;
	dynamicContext: DynamicContext<R, "value", R>;
}

type Destroy = () => void;

const defaultUseContextSelectorArgs = <Value extends any, RawValue extends any>(
	value: Value,
	rawValue: RawValue
) => {
	const rawValueRef = useRef(rawValue);
	rawValueRef.current = rawValue;
	return [value, () => rawValueRef.current] as const;
};

const defaultContextSelectorArgsEqualityFn = <T extends readonly any[]>(
	prevVal: T,
	newVal: T
) => {
	return prevVal[0] === newVal[0];
};

function pickKeys<T extends {}, K extends keyof T>(
	obj: T,
	keys: K[]
): Pick<T, K> {
	const obj2 = {} as Pick<T, K>;
	for (let i = 0; i < keys.length; ++i) {
		if (obj.hasOwnProperty(keys[i]) || obj[keys[i]] !== undefined) {
			obj2[keys[i]] = obj[keys[i]];
		}
	}
	return obj2;
}
const topPropsEquality = <T extends Record<any, any>>(obj1: T, obj2: T) =>
	areDeeplyEqual(obj1, obj2, 1);

export type DefSelectorArgs<Value, RawValue = Value> = [Value, () => RawValue];

export type DynamicContextOptions<
	RawValue,
	Value,
	ContextSelectorArgs extends readonly any[]
> = {
	rawToFinalValueHook?: (data: RawValue) => Value;
	selectorArgsHook?: (
		value: Value,
		rawValue: RawValue
	) => ContextSelectorArgs;
	selectorArgsEqualityFn?: (
		prevValue: ContextSelectorArgs,
		nextValue: ContextSelectorArgs
	) => boolean;
	selectorValueEqualityFn?: (prev: any, current: any) => boolean;
};
