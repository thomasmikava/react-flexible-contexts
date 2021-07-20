import React, { useContext, useRef, useState, useEffect } from "react";
import { ContextSubscriber } from "react-context-subscribers";
import { ContextSelectorHook } from "react-context-subscribers/lib/interfaces";
import { Subscription } from "simple-subscriptions";
import { useReRenderSubscription } from "./re-render";
import { areDeeplyEqual } from "./equality-functions";
import { dublicateEqualityFn } from "react-context-subscribers/lib//hook";
import { useMemoizedProps } from "./utils";

const EMPTY_VAL = `__$$emptyValue:?#@#y7q!}fmhW)eL}L{b#b^(3$ZAMg.eyp6NL#h<N-S$)L<.=-j3WsMp&%2JDf6_vVdN7K."pg"_aswq"9CRS?!9YzG[}AD~Xb[E__$$`;

export class DynamicContext<
	RawValue extends any,
	Key extends string | null,
	Value = RawValue,
	ContextSelectorArgs extends readonly any[] = DefSelectorArgs<
		Value,
		RawValue
	>,
	UnmodifiedRawValue = RawValue,
	ProviderProps extends Record<any, any> = Key extends string
		? Record<Key, UnmodifiedRawValue>
		: UnmodifiedRawValue
> {
	private readonly RawProvider: MinimalComponent<any>;
	private rawToFinalValueHook: (data: RawValue) => Value;
	private subscriberContext: ContextSubscriber<ContextSelectorArgs>;
	private readonly mainContext: React.Context<
		UnmodifiedRawValue | typeof EMPTY_VAL
	>;
	private displayName: string | undefined;

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
		private defaultValueGetter: () => UnmodifiedRawValue,
		private readonly key?: Key,
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	) {
		if (key === "undefined") {
			key = "value" as Key;
			this.key = key;
		}
		this.mainContext = React.createContext<
			UnmodifiedRawValue | typeof EMPTY_VAL
		>(EMPTY_VAL as any);
		this.displayName = this.mainContext.displayName;
		this.defaultValueGetter = defaultValueGetter;
		const rawToFinalValueHook = options
			? options.rawToFinalValueHook
			: undefined;
		this.rawToFinalValueHook =
			rawToFinalValueHook || ((x: RawValue) => (x as any) as Value);
		this.RawProvider = getRawProvider(
			this.key as string | null,
			this.mainContext
		);
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
			"hook",
			selectorArgsEqualityFn
		);
		this.useSelector = this.subscriberContext.useSelector;
		if (selectorValueEqualityFn) {
			this.useSelector.setEqualityFn(selectorValueEqualityFn);
		}
	}

	private getSubscriberContextDefaultValue = () => {

		const value = this.defaultValueGetter();
		const rawValue = !this.rawValueModifierHook
			? (value as RawValue)
			: this.rawValueModifierHook(value);

		const finalValue = this.rawToFinalValueHook(rawValue);
		return this.selectorArgsHook(finalValue, rawValue);
	};

	private defValueReRenders = new Subscription();

	setContextName(name: string | undefined) {
		this.mainContext.displayName = name;
		this.displayName = name;
	}

	setDefaultValue(rawValue: RawValue) {
		this.setDefaultValueGetter(() => rawValue);
	}

	setDefaultValueGetter(fn: () => RawValue) {
		this.defaultValueGetter = getDefaultValueFn(
			fn,
			() => this.defaultValueUnModifierFn
		);
		this.subscriberContext.setDefaultValueGetter(() =>
			this.getSubscriberContextDefaultValue()
		);
		this.defValueReRenders.broadcast();
	}

	useUnmodifiedRawValue = (): UnmodifiedRawValue => {
		let contextValue = useContext(this.mainContext);
		if (contextValue === EMPTY_VAL) {
			useReRenderSubscription(this.defValueReRenders);
			contextValue = this.defaultValueGetter();
		}
		if ((contextValue as any) === EMPTY_VAL) {
			throw new Error(
				"Dynamic Context without deafult value must be used with provider"
			);
		}
		return contextValue as any;
	};

	useRawValue = (): RawValue => {
		const value = this.useUnmodifiedRawValue();
		return !this.rawValueModifierHook
			? (value as RawValue)
			: this.rawValueModifierHook(value);
	};

	Provider: MinimalComponent<ProviderProps> = (props: any) => {
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
			return () => internalContextData.destroy();
		}, [internalContextData]);

		const RawProvider = this.RawProvider;
		const rawValue = this.useReconstructValue(props);
		const finalValue = this.rawToFinalValueHook(rawValue);
		const contextSelectorArgs = this.selectorArgsHook(finalValue, rawValue);
		internalContextData.useUpdateValue(...contextSelectorArgs);
		let lastChildren = children;
		for (const el of this.InternalHooks.arr) {
			const val = el.hook(finalValue);
			const InnerProvider = el.dynamicContext.Provider;
			const innerProps = el.dynamicContext.rawValueToProps(val);
			lastChildren = (
				<InnerProvider {...innerProps}>{lastChildren}</InnerProvider>
			);
		}
		const Int = this.subscriberContext.context.Provider;
		return (
			<Int value={internalContextData}>
				<RawProvider {...props}>{lastChildren}</RawProvider>
			</Int>
		);
	};

	private rawValueModifierHook:
		| ((rawValue: UnmodifiedRawValue) => RawValue)
		| undefined = undefined;
	private defaultValueModifierFn:
		| ((rawValue: UnmodifiedRawValue) => RawValue)
		| undefined = undefined;
	private defaultValueUnModifierFn:
		| ((rawValue: RawValue) => UnmodifiedRawValue)
		| undefined = undefined;
	private setRawValueModifiers(
		defaultValueUnModifierFn: (rawValue: RawValue) => UnmodifiedRawValue,
		defaultValueModifierFn: (rawValue: UnmodifiedRawValue) => RawValue,
		rawValueModifierHook: (
			rawValue: UnmodifiedRawValue
		) => RawValue = defaultValueModifierFn
	) {
		this.defaultValueUnModifierFn = defaultValueUnModifierFn;
		this.defaultValueModifierFn = defaultValueModifierFn;
		this.rawValueModifierHook = rawValueModifierHook;
	}
	private modifiedDefaultValueGetter() {
		if (this.defaultValueModifierFn) {
			return this.defaultValueModifierFn(this.defaultValueGetter());
		}
		return this.defaultValueGetter();
	}

	private useReconstructValue(props: any): RawValue {
		const contextRawValue =
			typeof this.key === "string"
				? props[this.key]
				: useMemoizedProps(props);
		return !this.rawValueModifierHook
			? contextRawValue
			: this.rawValueModifierHook(contextRawValue);
	}

	addInternalContext<Hook extends (value: Value) => any>(
		hook: Hook,
		displayName?: string
	): DynamicContext<ReturnType<Hook>, "value"> & { destroy: Destroy };
	addInternalContext<Hook extends (value: Value) => any>(
		hook: Hook,
		dynamicContext: DynamicContext<ReturnType<Hook>, any, any, any>
	): { destroy: Destroy };
	addInternalContext<Hook extends (value: Value) => any>(
		hook: Hook,
		arg2?: string | DynamicContext<ReturnType<Hook>, "value"> | undefined
	):
		| (DynamicContext<ReturnType<Hook>, "value"> & { destroy: Destroy })
		| { destroy: Destroy } {
		type R = ReturnType<Hook>;
		type DContext = DynamicContext<ReturnType<Hook>, "value"> & {
			destroy: Destroy;
		};
		let dynamicContext: DContext;
		this.InternalHooks.version++;
		if (!(arg2 instanceof DynamicContext)) {
			const displayName = arg2;
			const valueGetter = () => (hook(this.useValue()) as any) as R;

			const selectorValueEqualityFn = dublicateEqualityFn(
				this.useSelector
			);

			dynamicContext = new DynamicContext(valueGetter, "value", {
				selectorValueEqualityFn,
			}) as DContext;
			dynamicContext.setContextName(displayName);
		} else {
			dynamicContext = arg2 as DContext;
		}
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
		if (arg2 instanceof DynamicContext) {
			return { destroy };
		}
		dynamicContext.destroy = destroy;
		return dynamicContext;
	}

	private rawValueToProps = (rawValue: RawValue): any => {
		if (typeof this.key === "string") {
			return { [this.key]: rawValue };
		}
		return rawValue;
	};

	useValue = (): Value => {
		return this.useSelector((x => x) as any, []);
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
}

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

function getRawProvider<RawValue extends any>(
	key: string | null,
	mainContext: React.Context<RawValue>
): MinimalComponent<any> {
	const RawContextProvider = mainContext.Provider;
	if (key === "value") return RawContextProvider;

	if (typeof key === "string") {
		const Provider: React.FC<Record<string, RawValue>> = props => {
			const value = props[key as any] as RawValue;
			const children = props.children;
			return (
				<RawContextProvider value={value}>
					{children}
				</RawContextProvider>
			);
		};
		return Provider;
	}

	const Provider = createDestructuredProvider(mainContext as any);
	return Provider;
}

function createDestructuredProvider<Value extends {}>(
	RawContext: React.Context<Value>
): MinimalComponent<Value> {
	const Provider: React.FC<Value> = ({ children, ...rest }) => {
		const newVal = useMemoizedProps(rest);
		return (
			<RawContext.Provider value={newVal as Value}>
				{children}
			</RawContext.Provider>
		);
	};
	return Provider;
}

const getDefaultValueFn = <
	RawValue extends any,
	UnmodifiedRawValue extends any
>(
	fn: () => RawValue,
	getTransformerFn: () =>
		| ((value: RawValue) => UnmodifiedRawValue)
		| undefined
): (() => UnmodifiedRawValue) => {
	return (): UnmodifiedRawValue => {
		const val = fn();
		const transformer = getTransformerFn();
		if (!transformer) return val as UnmodifiedRawValue;
		return transformer(val);
	};
};
