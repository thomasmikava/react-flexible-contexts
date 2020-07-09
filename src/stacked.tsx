import React, { useContext } from "react";
import { DynamicContext, DefSubscriberVal } from "./dynamic";
import { EMPTY_VAL } from "./constanst";

export class StackedContext<
	Value extends Record<any, any>,
	FinalValue = Value,
	ContextSubscriberValue extends readonly any[] = DefSubscriberVal<
		Value,
		FinalValue
	>
> {
	readonly dynamicContext: DynamicContext<
		Value,
		"value",
		FinalValue,
		ContextSubscriberValue
	>;
	readonly hook: () => FinalValue;

	constructor({
		displayName,
		context,
		defaultValue,
		options,
	}: {
		displayName?: string;
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
		};
	} & (
		| {
				context: React.Context<Value>;
				defaultValue?: undefined;
		  }
		| { defaultValue: Value | null; context?: undefined }
	)) {
		if (!context) {
			context = React.createContext(
				((defaultValue ?? EMPTY_VAL) as any) as Value
			);
		}
		if (typeof displayName !== "undefined") {
			context.displayName = displayName;
		}
		this.dynamicContext = new DynamicContext(context, "value", options);
		this.hook = this.dynamicContext.hook;
	}

	getMainContext() {
		return this.dynamicContext.mainContext;
	}

	addProvider<
		OutHook extends (inArg: any, prevProviderValue: Value) => Value
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
}

const toArray = <T extends any>(el: T): T extends any[] ? T : [T] => {
	if (Array.isArray(el)) return el as any;
	return [el] as any;
};
