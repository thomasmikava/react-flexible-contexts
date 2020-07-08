import React, { useContext, useRef, useState, useEffect } from "react";
import { ContextSubscriber } from "./subscriber";
import { ContextSubscriberHook } from "./subscriber/interfaces";
const EMPTY_VAL = `__$$emptyValue:?#@#y7q!}fmhW)eL}L{b#b^(3$ZAMg.eyp6NL#h<N-S$)L<.=-j3WsMp&%2JDf6_vVdN7K."pg"_aswq"9CRS?!9YzG[}AD~Xb[E__$$`;

export class DynamicContext<
	Value extends any,
	Key extends string | null,
	FinalValue = Value
> {
	readonly hook: () => FinalValue;
	private readonly RawProvider: MinimalComponent<any>;
	private transformationHook: (data: Value) => FinalValue;
	private subscriberContext: ContextSubscriber<FinalValue>;

	readonly useSubscriber: ContextSubscriberHook<FinalValue>;

	private InternalHooks = {
		version: 0,
		arr: [] as HookInfo<FinalValue, any>[],
	};

	constructor(
		public readonly mainContext: React.Context<Value>,
		private readonly key?: Key,
		transformationHook?: (data: Value) => FinalValue
	) {
		if (key === "undefined") {
			key = "value" as Key;
			this.key = key;
		}
		this.transformationHook =
			transformationHook || ((x: Value) => (x as any) as FinalValue);
		this.hook = DynamicContext.createHookFromContext<Value, FinalValue>(
			this.mainContext,
			this.transformationHook
		);
		this.RawProvider = this.getRawProvider();
		this.subscriberContext = new ContextSubscriber<FinalValue>();
		this.useSubscriber = this.subscriberContext.useSubscriber;
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
		this.subscriberContext.updateLastProviderValue(
			internalContextData.id,
			realValue
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
		FinalValue = Value
	>(
		defaultValue: Value | undefined,
		key: K,
		transformationHook?: (data: Value) => FinalValue
	): DynamicContext<Value, K, FinalValue>;
	static createContext<Value extends any, FinalValue = Value>(
		defaultValue?: Value,
		key?: undefined | "value",
		transformationHook?: (data: Value) => FinalValue
	): DynamicContext<Value, "value", FinalValue>;
	static createContext<Value extends any, FinalValue = Value>(
		defaultValue?: Value,
		key = "value",
		transformationHook?: (data: Value) => FinalValue
	): any {
		const RawContext = React.createContext(
			((typeof defaultValue === "undefined"
				? EMPTY_VAL
				: defaultValue) as any) as Value
		);
		return new DynamicContext(RawContext, key, transformationHook);
	}

	static createContextForDestructured<Value extends {}, FinalValue = Value>(
		defaultValue?: Value,
		transformationHook?: (data: Value) => FinalValue
	): DynamicContext<Value, null, FinalValue> {
		const RawContext = React.createContext(
			((typeof defaultValue === "undefined"
				? EMPTY_VAL
				: defaultValue) as any) as Value
		);

		return new DynamicContext<Value, null, FinalValue>(
			RawContext,
			null,
			transformationHook
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

interface MinimalComponent<P = {}> {
	(props: P & { children?: React.ReactNode }): React.ReactElement | null;
}

interface HookInfo<Value extends any, R extends any> {
	fn: (value: Value) => R;
	dynamicContext: DynamicContext<R, "value", R>;
}

type Destroy = () => void;
