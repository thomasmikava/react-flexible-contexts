import React, { useContext, useRef, useState, useEffect } from "react";
import { ContextSubscriber } from "./subscriber";
import { ContextSubscriberHook } from "./subscriber/interfaces";
import { usePropsMemo } from "./hooks";

const EMPTY_VAL = `__$$emptyValue:?#@#y7q!}fmhW)eL}L{b#b^(3$ZAMg.eyp6NL#h<N-S$)L<.=-j3WsMp&%2JDf6_vVdN7K."pg"_aswq"9CRS?!9YzG[}AD~Xb[E__$$`;

export class DynamicContext<
	RawValue extends any,
	Key extends string | null,
	Value = RawValue,
	ContextSubscriberValue extends readonly any[] = DefSubscriberVal<
		RawValue,
		Value
	>
> {
	readonly useValue: () => Value;
	private readonly RawProvider: MinimalComponent<any>;
	private transformationHook: (data: RawValue) => Value;
	private subscriberContext: ContextSubscriber<ContextSubscriberValue>;

	readonly useSubscriber: ContextSubscriberHook<ContextSubscriberValue>;
	private readonly contextSubscriberValueHook: (
		value: Value,
		rawValue: RawValue
	) => ContextSubscriberValue;

	private InternalHooks = {
		version: 0,
		arr: [] as HookInfo<Value, any>[],
	};

	constructor(
		public readonly mainContext: React.Context<RawValue>,
		private readonly key?: Key,
		options?: {
			transformationHook?: (data: RawValue) => Value;
			contextSubscriberValueHook?: (
				value: Value,
				rawValue: RawValue
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	) {
		if (key === "undefined") {
			key = "value" as Key;
			this.key = key;
		}
		const transformationHook = options
			? options.transformationHook
			: undefined;
		this.transformationHook =
			transformationHook || ((x: RawValue) => (x as any) as Value);
		this.useValue = DynamicContext.createHookFromContext<RawValue, Value>(
			this.mainContext,
			this.transformationHook
		);
		this.RawProvider = this.getRawProvider();
		let contextSubscriberEqualityFn = options
			? options.contextSubscriberEqualityFn
			: undefined;
		const contextSubscriberValueHook = options
			? options.contextSubscriberValueHook
			: undefined;
		if (!contextSubscriberValueHook) {
			contextSubscriberEqualityFn = defaultContextSubscriberEqualityFn;
		}
		this.subscriberContext = new ContextSubscriber<ContextSubscriberValue>(
			contextSubscriberEqualityFn
		);
		this.useSubscriber = this.subscriberContext.useSubscriber;
		this.contextSubscriberValueHook =
			contextSubscriberValueHook ||
			(defaultContextSubscriberValueHook as any);
	}

	setContextName(name: string | undefined) {
		this.mainContext.displayName = name;
	}

	useRawValue = () => {
		return useContext(this.mainContext);
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
		const finalValue = this.transformationHook(rawValue);
		const contextSubscriberValue = this.contextSubscriberValueHook(
			finalValue,
			rawValue
		);
		this.subscriberContext.updateLastProviderValue(
			internalContextData.id,
			...contextSubscriberValue
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
		const context = React.createContext((EMPTY_VAL as any) as R);
		context.displayName = displayName;
		const dynamicContext = new DynamicContext(
			context,
			"value"
		) as DynamicContext<ReturnType<Hook>, "value"> & { destroy: Destroy };
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

	static createHookFromContext<RawValue, Value = RawValue>(
		context: React.Context<RawValue>,
		transformationHook?: (rawData: RawValue) => Value
	): () => Value {
		return () => {
			const rawValue = useContext(context);
			if ((rawValue as any) === EMPTY_VAL) {
				throw new Error(
					"Dynamic Context without deafult value or with internal contexts must be used with provider"
				);
			}
			if (transformationHook) return transformationHook(rawValue);
			return (rawValue as any) as Value;
		};
	}

	static create<
		RawValue extends any,
		K extends string | null,
		Value = RawValue,
		ContextSubscriberValue extends readonly any[] = [Value, () => RawValue]
	>(
		defaultValue: RawValue | undefined,
		key: K,
		options?: {
			transformationHook?: (data: RawValue) => Value;
			contextSubscriberValueHook?: (
				value: Value,
				rawValue: RawValue
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	): DynamicContext<RawValue, K, Value>;
	static create<
		RawValue extends any,
		Value = RawValue,
		ContextSubscriberValue extends readonly any[] = [Value, () => RawValue]
	>(
		defaultValue?: RawValue,
		key?: undefined | "value",
		options?: {
			transformationHook?: (data: RawValue) => Value;
			contextSubscriberValueHook?: (
				value: Value,
				rawValue: RawValue
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	): DynamicContext<RawValue, "value", Value>;
	static create<RawValue extends any, Value = RawValue>(
		defaultValue?: RawValue,
		key = "value",
		options?: any
	): any {
		const RawContext = React.createContext(
			((typeof defaultValue === "undefined"
				? EMPTY_VAL
				: defaultValue) as any) as RawValue
		);
		return new DynamicContext(RawContext, key, options);
	}

	static createDestructured<
		RawValue extends Record<any, any>,
		Value = RawValue,
		ContextSubscriberValue extends readonly any[] = [Value, () => RawValue]
	>(
		defaultValue?: RawValue,
		options?: {
			transformationHook?: (data: RawValue) => Value;
			contextSubscriberValueHook?: (
				value: Value,
				rawValue: RawValue
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	): DynamicContext<RawValue, null, Value, ContextSubscriberValue> {
		const RawContext = React.createContext(
			((typeof defaultValue === "undefined"
				? EMPTY_VAL
				: defaultValue) as any) as RawValue
		);

		return new DynamicContext<
			RawValue,
			null,
			Value,
			ContextSubscriberValue
		>(RawContext, null, options);
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

interface MinimalComponent<P = {}> {
	(props: P & { children?: React.ReactNode }): React.ReactElement | null;
}

interface HookInfo<Value extends any, R extends any> {
	hook: (value: Value) => R;
	dynamicContext: DynamicContext<R, "value", R>;
}

type Destroy = () => void;

const defaultContextSubscriberValueHook = <
	Value extends any,
	RawValue extends any
>(
	value: Value,
	rawValue: RawValue
) => {
	const rawValueRef = useRef(rawValue);
	rawValueRef.current = rawValue;
	return [value, () => rawValueRef.current] as const;
};

const defaultContextSubscriberEqualityFn = <T extends readonly any[]>(
	prevVal: T,
	newVal: T
) => {
	return prevVal[0] === newVal[0];
};

export type DefSubscriberVal<RawValue, Value> = [Value, () => RawValue];
