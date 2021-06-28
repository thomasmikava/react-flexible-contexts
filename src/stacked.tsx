import React, { useMemo } from "react";
import {
	DynamicContext,
	DefSelectorArgs,
	DynamicContextOptions,
	MinimalComponent,
} from "./dynamic";
import { useMemoizedProps } from "./utils";

export class StackedContext<
	RawValue extends any,
	Key extends string | null = "value",
	Value = RawValue,
	InternalContext extends StackInternalContext<
		Value,
		RawValue,
		Key
	> = StackInternalContext<Value, RawValue, Key>
> {
	readonly context: InternalContext;
	readonly Provider: InternalContext["Provider"];
	readonly useValue: () => Value;
	private readonly key: string | null;
	private originalProvider: InternalContext["Provider"];

	static create<
		RawValue extends any,
		Value = RawValue,
		Key extends string = "value",
		ContextSelectorArgs extends readonly any[] = DefSelectorArgs<
			RawValue,
			Value
		>
	>(
		defaultValue?: RawValue,
		key?: Key,
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	): StackedContext<
		RawValue,
		Key,
		Value,
		DynamicContext<
			RawValue,
			Key,
			Value,
			DefSelectorArgs<Value, RawValue>,
			RawValue /* SavedAdditionalMetaProps<RawValue> */,
			Record<Key, RawValue> & PassableAdditionalMetaProps
		>
	> {
		const normalizedKey = typeof key === "string" ? key : ("value" as Key);
		const dynamicContext = DynamicContext.create(
			defaultValue === undefined
				? undefined
				: (rootDataForStackedContext(defaultValue) as any),
			normalizedKey,
			options
		);
		return new StackedContext(dynamicContext as any, normalizedKey) as any;
	}

	static createDestructured<
		RawValue extends Record<any, any>,
		Value = RawValue,
		ContextSelectorArgs extends readonly any[] = DefSelectorArgs<
			RawValue,
			Value
		>
	>(
		defaultValue?: RawValue,
		options?: DynamicContextOptions<RawValue, Value, ContextSelectorArgs>
	): StackedContext<
		RawValue,
		null,
		Value,
		DynamicContext<
			RawValue,
			null,
			Value,
			DefSelectorArgs<Value, RawValue>,
			RawValue /* SavedAdditionalMetaProps<RawValue> */,
			RawValue & PassableAdditionalMetaProps
		>
	> {
		const dynamicContext = DynamicContext.createDestructured(
			defaultValue === undefined
				? undefined
				: (rootDataForStackedContext(defaultValue) as any),
			options
		);
		return new StackedContext(dynamicContext as any, null) as any;
	}

	constructor(internalContext: InternalContext, key: Key) {
		this.context = internalContext;
		this.useValue = this.context.useValue;
		this.key = key === undefined ? "value" : key;
		const defaultValueGetter = (
			withMeta: SavedAdditionalMetaProps<RawValue>
		) => {
			return withMeta.prevRawValues[withMeta.prevRawValues.length - 1]
				.calc;
		};
		(this.context as any).setRawValueModifiers(
			rootDataForStackedContext,
			defaultValueGetter,
			defaultValueGetter
		);
		const originalProvider = this.context.Provider;
		this.originalProvider = originalProvider;
		if (typeof this.key !== "string") {
			this.context.Provider = (this.addDestructuredProvider as any)();
		} else {
			this.context.Provider = (this.addProvider as any)();
		}
		this.Provider = this.context.Provider;
	}

	addProvider<In extends any>(
		outValueHook: (inArg: In, prevProviderValue: RawValue) => RawValue
	): MinimalComponent<{ value: In } & PassableAdditionalMetaProps>;
	addProvider<In extends any>(
		outValueHook?: (inArg: In, prevProviderValue: RawValue) => RawValue
	): MinimalComponent<{ value: In } & PassableAdditionalMetaProps> {
		const component: MinimalComponent<{
			value: In;
		} & PassableAdditionalMetaProps> = ({
			children,
			value,
			__order,
		}: { value: In; children: any } & PassableAdditionalMetaProps) => {
			return this.providerHelper(value, __order, children, outValueHook);
		};
		return component;
	}

	addDestructuredProvider<In extends Record<any, any>>(
		outValueHook: OutValuHook<RawValue, In>
	): MinimalComponent<In & PassableAdditionalMetaProps>;
	addDestructuredProvider<In extends Record<any, any>>(
		outValueHook?: OutValuHook<RawValue, In>
	): MinimalComponent<In & PassableAdditionalMetaProps> {
		const component: MinimalComponent<In & PassableAdditionalMetaProps> = ({
			children,
			__order,
			...props
		}) => {
			const input = useMemoizedProps((props as any) as In);
			return this.providerHelper(input, __order, children, outValueHook);
		};
		return component;
	}

	private providerHelper = <In extends any>(
		input: In,
		__order: number | undefined,
		children: any,
		outValueHook: OutValuHook<RawValue, In> | undefined
	) => {
		const prev = !outValueHook
			? undefined
			: (this.context
					.useUnmodifiedRawValue!() as SavedAdditionalMetaProps<
					RawValue
			  >);
		const increment = prev ? prev.prevRawValues.length : 0;
		const [mergedValue, compKey] = this.useMergeMeta(
			{
				input,
				order:
					(typeof __order === "number"
						? __order > 0
							? __order + 1
							: __order - 1
						: 0) + increment,
				outHook: outValueHook,
				calc: undefined as any,
			},
			prev
		);
		return React.createElement(this.providerHelper2, {
			mergedValue,
			key: compKey,
			children,
		});
	};

	private providerHelper2 = ({
		mergedValue,
		children,
	}: {
		mergedValue: WithoutCalculated<RawValue>;
		children: any;
	}) => {
		const calculatedValues = useCalculated<RawValue>(mergedValue);
		const deps = (calculatedValues as any[]).concat([mergedValue]);
		const passingValue: SavedAdditionalMetaProps<RawValue> = useMemo(
			() => ({
				...mergedValue,
				prevRawValues: mergedValue.prevRawValues.map((e, i) =>
					i < mergedValue.ind
						? e
						: { ...e, calc: calculatedValues[i - mergedValue.ind] }
				),
				calculatedValue: calculatedValues[calculatedValues.length - 1],
			}),
			deps
		);
		return React.createElement(
			this.originalProvider,
			this.key === null
				? passingValue
				: ({ [this.key]: passingValue } as any),
			...toArray(children)
		);
	};

	private useMergeMeta = <In extends any>(
		unMemoizedCurrent: Elem<In, RawValue>,
		prev?: SavedAdditionalMetaProps<RawValue>
	): [WithoutCalculated<RawValue>, string] => {
		const current = useMemoizedProps(unMemoizedCurrent);
		const prevRaws = prev?.prevRawValues || [];
		const newA = [...prevRaws, current];

		return useMemo(() => {
			const prevRawValues = [...newA].sort((a, b) => a.order - b.order);
			const elem: WithoutCalculated<RawValue> = {
				prevRawValues,
				__$Stacked: true,
				isAscending: getHighestOrder(prevRawValues) === current.order,
				ind: prevRawValues.indexOf(current),
			};
			return [elem, generateCompKey(newA)];
		}, newA);
		// return outValueHook!(value, prev as any) as any;
	};
}

const getHighestOrder = (arr: Elem<any, any>[]) => {
	let highest = -Infinity;
	for (let i = 0; i < arr.length; ++i) {
		if (arr[i].order > highest) highest = arr[i].order;
	}
	return highest;
};

const toArray = <T extends any>(el: T): T extends any[] ? T : [T] => {
	if (Array.isArray(el)) return el as any;
	return [el] as any;
};

const generateCompKey = (elem: Elem<any, any>[]): string => {
	return elem.map(e => e.order).join("&");
};

type StackInternalContext<Value, RawValue, Key extends string | null> = {
	useValue(): Value;
	// useRawValue(): RawValue;
	Provider: MinimalComponent<
		(Key extends string ? Record<Key, RawValue> : RawValue) &
			PassableAdditionalMetaProps
	>;
	useUnmodifiedRawValue: () => any;
};

export interface PassableAdditionalMetaProps {
	__order?: number;
}

type Elem<In extends any, RawValue> = {
	input: In;
	order: number;
	outHook?: OutValuHook<RawValue, any>;
	isRoot?: true;
	calc: RawValue;
};
interface SavedAdditionalMetaProps<RawValue> {
	prevRawValues: Elem<any, RawValue>[];
	__$Stacked: true;
	isAscending?: boolean;
	ind: number;
}

type WithoutCalculated<RawValue> = Omit<
	SavedAdditionalMetaProps<RawValue>,
	"calculatedValue"
>;

type OutValuHook<RawValue, In extends any> = (
	inArg: In,
	prevProviderValue: RawValue
) => RawValue;

export const rootDataForStackedContext = <RawValue extends any>(
	rawValue: RawValue
): SavedAdditionalMetaProps<RawValue> => {
	return {
		prevRawValues: [
			{ input: rawValue, order: -Infinity, isRoot: true, calc: rawValue },
		],
		__$Stacked: true,
		ind: 0,
	};
};

const useCalculated = <RawValue extends any>(
	meta: WithoutCalculated<RawValue>
): RawValue[] => {
	let value: RawValue | undefined = undefined;
	let startIndex = 0;
	const elemns = meta.prevRawValues;
	if (meta.ind >= 1) {
		startIndex = meta.ind;
		value = elemns[meta.ind - 1].calc;
	}
	const values: RawValue[] = [];
	for (let i = startIndex; i < elemns.length; ++i) {
		const elem = elemns[i];
		if (!elem.outHook) {
			value = elem.input;
		} else {
			value = elem.outHook(elem.input, value!);
		}
		values.push(value!);
	}
	return values;
};
