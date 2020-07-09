import React, { useContext, useRef, useState, useEffect } from "react";
import { ContextSubscriber } from "./subscriber";
import { ContextSubscriberHook } from "./subscriber/interfaces";
import { EMPTY_VAL } from "./constanst";

export class DynamicContext<
	Value extends any,
	Key extends string | null,
	FinalValue = Value,
	ContextSubscriberValue extends readonly any[] = DefSubscriberVal<
		Value,
		FinalValue
	>
> {
	readonly hook: () => FinalValue;
	private readonly RawProvider: MinimalComponent<any>;
	private transformationHook: (data: Value) => FinalValue;
	private subscriberContext: ContextSubscriber<ContextSubscriberValue>;

	readonly useSubscriber: ContextSubscriberHook<ContextSubscriberValue>;
	private readonly contextSubscriberValueHook: (
		finalValue: FinalValue,
		value: Value
	) => ContextSubscriberValue;

	private InternalHooks = {
		version: 0,
		arr: [] as HookInfo<FinalValue, any>[],
	};

	constructor(
		public readonly mainContext: React.Context<Value>,
		private readonly key?: Key,
		options?: {
			transformationHook?: (data: Value) => FinalValue;
			contextSubscriberValueHook?: (
				finalValue: FinalValue,
				value: Value
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
			transformationHook || ((x: Value) => (x as any) as FinalValue);
		this.hook = DynamicContext.createHookFromContext<Value, FinalValue>(
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

	Provider: MinimalComponent<
		Key extends string ? Record<Key, Value> : Value
	> = (props: any) => {
		const Provider = this.providerHelper;
		return <Provider {...props} key={this.InternalHooks.version} />;
	};

	private providerHelper: MinimalComponent<
		Key extends string ? Record<Key, Value> : Value
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
		const realRawValue = this.reconstructValue(props);
		const realValue = this.transformationHook(realRawValue);
		const contextSubscriberValue = this.contextSubscriberValueHook(
			realValue,
			realRawValue
		);
		this.subscriberContext.updateLastProviderValue(
			internalContextData.id,
			...contextSubscriberValue
		);
		let lastChildren = children;
		for (const el of this.InternalHooks.arr) {
			const Provider = el.dynamicContext.Provider;
			const val = el.fn(realValue);
			lastChildren = <Provider value={val}>{lastChildren}</Provider>;
		}
		const Int = this.subscriberContext.context.Provider;
		return (
			<Int value={internalContextData}>
				<RawProvider {...props}>{lastChildren}</RawProvider>
			</Int>
		);
	};

	private reconstructValue(props: any): Value {
		if (typeof this.key === "string") {
			return props[this.key];
		}
		return props;
	}

	addInternalContext<Fn extends (value: FinalValue) => any>(
		fn: Fn,
		displayName?: string
	): DynamicContext<ReturnType<Fn>, "value"> & { destroy: Destroy } {
		type R = ReturnType<Fn>;
		this.InternalHooks.version++;
		const context = React.createContext((EMPTY_VAL as any) as R);
		context.displayName = displayName;
		const dynamicContext = new DynamicContext(
			context,
			"value"
		) as DynamicContext<ReturnType<Fn>, "value"> & { destroy: Destroy };
		const el: HookInfo<FinalValue, R> = {
			fn,
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
			const Provider: React.FC<Record<string, Value>> = props => {
				const value = props[this.key as any] as Value;
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

	static createHookFromContext<T, FinalT = T>(
		context: React.Context<T>,
		transformationHook?: (rawData: T) => FinalT
	): () => FinalT {
		return () => {
			const val = useContext(context);
			if ((val as any) === EMPTY_VAL) {
				throw new Error(
					"Dynamic Context without deafult value must have a provider"
				);
			}
			if (transformationHook) return transformationHook(val);
			return (val as any) as FinalT;
		};
	}

	static createContext<
		Value extends any,
		K extends string | null,
		FinalValue = Value,
		ContextSubscriberValue extends readonly any[] = [
			FinalValue,
			() => Value
		]
	>(
		defaultValue: Value | undefined,
		key: K,
		options?: {
			transformationHook?: (data: Value) => FinalValue;
			contextSubscriberValueHook?: (
				finalValue: FinalValue,
				value: Value
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	): DynamicContext<Value, K, FinalValue>;
	static createContext<
		Value extends any,
		FinalValue = Value,
		ContextSubscriberValue extends readonly any[] = [
			FinalValue,
			() => Value
		]
	>(
		defaultValue?: Value,
		key?: undefined | "value",
		options?: {
			transformationHook?: (data: Value) => FinalValue;
			contextSubscriberValueHook?: (
				finalValue: FinalValue,
				value: Value
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	): DynamicContext<Value, "value", FinalValue>;
	static createContext<Value extends any, FinalValue = Value>(
		defaultValue?: Value,
		key = "value",
		options?: any
	): any {
		const RawContext = React.createContext(
			((typeof defaultValue === "undefined"
				? EMPTY_VAL
				: defaultValue) as any) as Value
		);
		return new DynamicContext(RawContext, key, options);
	}

	static createContextForDestructured<
		Value extends Record<any, any>,
		FinalValue = Value,
		ContextSubscriberValue extends readonly any[] = [
			FinalValue,
			() => Value
		]
	>(
		defaultValue?: Value,
		options?: {
			transformationHook?: (data: Value) => FinalValue;
			contextSubscriberValueHook?: (
				finalValue: FinalValue,
				value: Value
			) => ContextSubscriberValue;
			contextSubscriberEqualityFn?: (
				prevValue: ContextSubscriberValue,
				nextValue: ContextSubscriberValue
			) => boolean;
		}
	): DynamicContext<Value, null, FinalValue, ContextSubscriberValue> {
		const RawContext = React.createContext(
			((typeof defaultValue === "undefined"
				? EMPTY_VAL
				: defaultValue) as any) as Value
		);

		return new DynamicContext<
			Value,
			null,
			FinalValue,
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
	fn: (value: Value) => R;
	dynamicContext: DynamicContext<R, "value", R>;
}

type Destroy = () => void;

const defaultContextSubscriberValueHook = <
	FinalValue extends any,
	Value extends any
>(
	finalValue: FinalValue,
	rawValue: Value
) => {
	return [finalValue, () => rawValue] as const;
};

const defaultContextSubscriberEqualityFn = <T extends readonly any[]>(
	prevVal: T,
	newVal: T
) => {
	return prevVal[0] === newVal[0];
};

export type DefSubscriberVal<Value, FinalValue> = [FinalValue, () => Value];
