import React, { useContext, useMemo } from "react";
import { DynamicContext } from "./dynamic";

const EMPTY_VAL = `__$$emptyValue:DCgPBc^T#6@n_9fr]4;{pp#wKJh:{^edH/82PeH)72U/*aYWzhj#Ck,ffysw%<N?%zjDg$$`;

export class StackedContext<
	Value extends Record<any, any>,
	ValueWithMeta extends {
		value: Value;
		meta: any;
	} = {
		value: Value;
		meta: any;
	},
	FinalValue = Value
> {
	private readonly finalTransformationHook?: (
		data: ValueWithMeta
	) => FinalValue;
	readonly dynamicContext: DynamicContext<ValueWithMeta, "value", FinalValue>;
	readonly hook: () => FinalValue;

	constructor({
		finalTransformationHook,
		displayName,
		context,
		defaultValue,
		defaultMeta,
	}: {
		finalTransformationHook?: (data: ValueWithMeta) => FinalValue;
		displayName?: string;
	} & (
		| {
				context: React.Context<ValueWithMeta>;
				defaultValue?: undefined;
				defaultMeta?: undefined;
		  }
		| { defaultValue: Value | null; defaultMeta: any; context?: undefined }
	)) {
		if (!context) {
			context = React.createContext({
				value: ((defaultValue ?? EMPTY_VAL) as any) as Value,
				meta: defaultMeta,
			} as ValueWithMeta);
		}
		if (typeof displayName !== "undefined") {
			context.displayName = displayName;
		}
		this.finalTransformationHook = finalTransformationHook;
		this.dynamicContext = new DynamicContext(
			context,
			"value",
			this.rawValueToFinal
		);
		this.hook = this.dynamicContext.hook;
	}

	getMainContext() {
		return this.dynamicContext.mainContext;
	}

	addProvider<
		OutHook extends (
			inArg: any,
			prevProviderValue: ValueWithMeta
		) => ValueWithMeta
	>(outValueHook: OutHook): any {
		type In = Parameters<OutHook>[0];
		const component: React.FC<{ value: In }> = ({
			children,
			value: rawValue,
		}) => {
			const prevProviderValue = useContext(
				this.dynamicContext.mainContext
			);
			const value = outValueHook(rawValue, prevProviderValue);
			return React.createElement(
				this.dynamicContext.Provider,
				{ value },
				...toArray(children)
			);
		};
		return component;
	}

	static wrapInMeta = <Data, TransformedData>(
		getValueHook: (
			customizations: Data,
			prevVal: TransformedData
		) => TransformedData,
		getCurrentMetaHook: (customizations: Data, prevMeta: any) => any
	): ((
		customizations: Data,
		prevVal: WithStackedMeta<TransformedData>
	) => WithStackedMeta<TransformedData>) => {
		return (
			customizations: Data,
			prevValWithMeta: WithStackedMeta<TransformedData>
		) => {
			const currentMeta = getCurrentMetaHook(
				customizations,
				prevValWithMeta.meta
			);
			const meta = useMemo(() => {
				return [currentMeta, ...(prevValWithMeta.meta || [])];
			}, [currentMeta, prevValWithMeta.meta]);
			const value = getValueHook(customizations, prevValWithMeta.value);
			return useMemo(
				(): WithStackedMeta<TransformedData> => ({
					meta,
					value,
				}),
				[meta, value]
			);
		};
	};

	private rawValueToFinal = (rawValue: ValueWithMeta): FinalValue => {
		if (this.finalTransformationHook) {
			return this.finalTransformationHook(rawValue);
		}
		return rawValue.value as FinalValue;
	};
}

const toArray = <T extends any>(el: T): T extends any[] ? T : [T] => {
	if (Array.isArray(el)) return el as any;
	return [el] as any;
};

interface WithStackedMeta<V> {
	value: V;
	meta: any[];
}
