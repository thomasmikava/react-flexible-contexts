import React from "react";
import { DynamicContext, DefSubscriberVal } from "./dynamic";

export class StackedContext<
	RawValue extends any,
	Value = RawValue,
	InternalContext extends StackInternalContext<
		Value,
		RawValue
	> = StackInternalContext<Value, RawValue>
> {
	readonly context: InternalContext;
	readonly useValue: () => Value;

	static create<
		RawValue extends any,
		Value = RawValue,
		ContextSubscriberValue extends readonly any[] = DefSubscriberVal<
			RawValue,
			Value
		>
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
	): StackedContext<
		RawValue,
		Value,
		DynamicContext<RawValue, "value", Value>
	> {
		const dynamicContext = DynamicContext.create(
			defaultValue,
			"value",
			options
		);
		return new StackedContext(dynamicContext) as any;
	}

	constructor(internalContext: InternalContext) {
		this.context = internalContext;
		this.useValue = this.context.useValue;
	}

	addProvider<In extends any>(
		outValueHook: (inArg: In, prevProviderValue: RawValue) => RawValue
	): React.FC<{ value: In }> {
		const component: React.FC<{ value: In }> = ({
			children,
			value: rawValue,
		}) => {
			const prevProviderValue = this.context.useRawValue();
			const value = outValueHook(rawValue, prevProviderValue);
			return React.createElement(
				this.context.Provider,
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

type StackInternalContext<Value, RawValue> = {
	useValue(): Value;
	useRawValue(): RawValue;
	Provider: React.FC<{ value: RawValue }>;
};
