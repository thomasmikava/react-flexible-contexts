import React, { useContext } from "react";
import { Subscription } from "./subscription";
import { ContextSubscraberValue, ContextSelectorHook } from "./interfaces";
import { createContextSelectorHook } from "./hook";

const EMPTY_VAL = `__$$emptyValue:-r$H5*AUg&TPWUkH_fPbLLNJQfHF4WQ%&rey)qCJP+]83~J^v__$$`;

export class ContextSubscriber<Data extends readonly any[]> {
	readonly context: React.Context<ContextSubscraberValue<Data>>;
	readonly useSelector: ContextSelectorHook<Data>;
	private readonly defaultProvider: ContextSubscraberValue<Data>;

	private readonly useGettingDefaultValue = () => {
		const value = this.defaultValueGetter();
		if ((value as any) === EMPTY_VAL) {
			throw new Error(
				"Cannot use ContextSubscriber without default value or provider"
			);
		}
		this.updateLastProviderValue(this.defaultProvider.id, ...value);
	};

	constructor(
		private defaultValueGetter: () => Data = (() => EMPTY_VAL) as any,
		private readonly equalityFn: (
			prev: Data,
			next: Data
		) => boolean = defaultShallowEquality
	) {
		this.defaultProvider = this.registerNewProvider();
		this.context = React.createContext(this.defaultProvider);
		this.useSelector = createContextSelectorHook(
			this.context,
			this.defaultProvider.id,
			this.useGettingDefaultValue
		);
	}

	setDefaultValueGetter(fn: () => Data) {
		this.defaultValueGetter = fn;
	}

	private counter = 0;

	private lastValuesByProviderIds: Record<any, Data> = {};
	private subscriptionsByProviderIds: Record<any, Subscription<(...args: Data) => void>> = {};

	updateLastProviderValue = (id: IdType, ...value: Data) => {
		const isInitialCall = !this.lastValuesByProviderIds.hasOwnProperty(id);
		const oldValue = this.lastValuesByProviderIds[id];
		this.lastValuesByProviderIds[id] = value;
		if (!isInitialCall && !this.equalityFn(oldValue, value)) {
			type R = Parameters<(...args: Data) => void>;
			this.subscriptionsByProviderIds[id].broadcast(...value as any);
		}
	};

	destroyIntervalProvider = (id: IdType) => {
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
		};
	};

	private getValue = (id: IdType) => {
		if (!this.lastValuesByProviderIds.hasOwnProperty(id)) {
			throw new Error("context is not initialized yet");
		}
		const data = this.lastValuesByProviderIds[id];
		return data;
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
