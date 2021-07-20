import React, { useContext, useLayoutEffect } from "react";
import { Subscription } from "simple-subscriptions";
import { ContextSubscraberValue, ContextSelectorHook } from "./interfaces";
import { createContextSelectorHook } from "./hook";

const EMPTY_VAL = `__$$emptyValue:-r$H5*AUg&TPWUkH_fPbLLNJQfHF4WQ%&rey)qCJP+]83~J^v__$$`;

export class ContextSubscriber<Data extends readonly any[]> {
	readonly context: React.Context<ContextSubscraberValue<Data>>;
	readonly useSelector: ContextSelectorHook<Data>;
	readonly defaultProvider: ContextSubscraberValue<Data>;

	private readonly useGettingDefaultValue = () => {
		const value = this.defaultValueGetter();
		if ((value as any) === EMPTY_VAL) {
			throw new Error(
				"Cannot use ContextSubscriber without default value or provider"
			);
		}
		this.defaultProvider.useUpdateValue(...value);
	};

	constructor(
		private defaultValueGetter: () => Data = (() => EMPTY_VAL) as any,
		getterType: "function" | "hook" = "function",
		private readonly equalityFn: (
			prev: Data,
			next: Data
		) => boolean = defaultShallowEquality
	) {
		this.defaultProvider = this.registerNewProvider();
		this.context = React.createContext(this.defaultProvider);
		if (getterType === "hook") {
			this.useSelector = createContextSelectorHook(
				this.context,
				(id) => id === this.defaultProvider.id,
				this.useGettingDefaultValue
			);
		} else {
			this.lastValuesByProviderIds[
				this.defaultProvider.id
			] = { data: this.defaultValueGetter() };
			this.useSelector = createContextSelectorHook(
				this.context,
				() => false,
				this.defaultValueGetter
			);
		}
	}

	setDefaultValueGetter(fn: () => Data) {
		this.defaultValueGetter = fn;
	}

	private counter = 0;

	private lastValuesByProviderIds: Record<any, {data?: Data; tempData?: Data; useTempData?: boolean }> = {};
	private subscriptionsByProviderIds: Record<
		any,
		Subscription<(...args: Data) => void>
	> = {};

	private readonly updateLastProviderValue = (id: IdType, ...value: Data) => {
		const isInitialCall = !this.lastValuesByProviderIds.hasOwnProperty(id) || !this.lastValuesByProviderIds[id].hasOwnProperty("data");
		const oldValue = this.lastValuesByProviderIds[id] && (this.lastValuesByProviderIds[id].hasOwnProperty("data") ? this.lastValuesByProviderIds[id].data : this.lastValuesByProviderIds[id].tempData!);
		if (!this.lastValuesByProviderIds[id]) {
			this.lastValuesByProviderIds[id] = { data: value };
		} else {
			if (!this.lastValuesByProviderIds[id].hasOwnProperty("data")) {
				this.lastValuesByProviderIds[id].data = this.lastValuesByProviderIds[id].tempData;
			}
			this.lastValuesByProviderIds[id].useTempData = false;
			delete this.lastValuesByProviderIds[id].tempData;
		}

		const areEqual = isInitialCall ? false : this.equalityFn(oldValue!, value);

		if (!areEqual) {
			this.lastValuesByProviderIds[id].data = value;
			this.subscriptionsByProviderIds[id].broadcast(...(value as any));
		}
	};
	
	private readonly updateTempValue = (id: IdType, ...value: Data) => {
		const isInitialCall = !this.lastValuesByProviderIds.hasOwnProperty(id);
		const oldValue = this.lastValuesByProviderIds[id] && (this.lastValuesByProviderIds[id].useTempData ? this.lastValuesByProviderIds[id].tempData! : this.lastValuesByProviderIds[id].data);
		if (isInitialCall) this.lastValuesByProviderIds[id] = {  };
		this.lastValuesByProviderIds[id].useTempData = true;
		if (isInitialCall || !this.lastValuesByProviderIds[id].hasOwnProperty("tempData") || !this.equalityFn(oldValue!, value)) {
			this.lastValuesByProviderIds[id].tempData = value;
		}
	};

	private destroyIntervalProvider = (id: IdType) => {
		setTimeout(() => {
			delete this.lastValuesByProviderIds[id];
		}, 1);
	};

	registerNewProvider = (): ContextSubscraberValue<Data> => {
		this.counter++;
		const id = this.counter;
		const subscription = new Subscription<(...args: Data) => void>();
		this.subscriptionsByProviderIds[id] = subscription;
		return {
			id,
			getLatestValue: () => this.getValue(id),
			subscribe: subscription.subscribe,
			asyncReverseOrderSubscribe: subscription.asyncReverseOrderSubscribe,
			updateValue: (...value: Data) =>
				this.updateLastProviderValue(id, ...value),
			useUpdateValue: (...value: Data) => {
				this.updateTempValue(id, ...value);
				useLayoutEffect(() => {
					this.updateLastProviderValue(id, ...value);
				})
			},
			destroy: () => this.destroyIntervalProvider(id),
			isDestroyed: () => !this.lastValuesByProviderIds.hasOwnProperty(id),
		};
	};

	private getValue = (id: IdType) => {
		if (!this.lastValuesByProviderIds.hasOwnProperty(id)) {
			throw new Error("context is not initialized yet");
		}
		const val = this.lastValuesByProviderIds[id];
		if (val.useTempData) return val.tempData! as Data;
		return val.data!;
	};

	hook = () => {
		return useContext(this.context);
	};
}

const defaultShallowEquality = <Data extends readonly any[]>(
	prev: Data,
	next: Data
): boolean => {
	if (prev.length !== next.length) return false;
	for (let i = 0; i < prev.length; i++) {
		if (prev[i] !== next[i]) return false;
	}
	return true;
};

type IdType = number;
