import React, { useContext } from "react";
import { Subscription } from "./subscription";
import { ContextSubscraberValue, ContextSubscriberHook } from "./interfaces";
import { createContextSubscriberHook } from "./hook";

const EMPTY_VAL = `__$$emptyValue:-r$H5*AUg&TPWUkH_fPbLLNJQfHF4WQ%&rey)qCJP+]83~J^v__$$`;

export class ContextSubscriber<Data> {
	readonly context: React.Context<ContextSubscraberValue<Data>>;
	readonly useSubscriber: ContextSubscriberHook<Data>;

	constructor() {
		this.context = React.createContext(EMPTY_VAL as any);
		this.useSubscriber = createContextSubscriberHook(this.context);
	}

	private counter = 0;

	private lastValuesByProviderIds: Record<any, Data> = {};
	private subscriptionsByProviderIds: Record<any, Subscription<Data>> = {};

	updateLastProviderValue = (id: IdType, value: Data) => {
		const isInitialCall = !this.lastValuesByProviderIds.hasOwnProperty(id);
		const oldValue = this.lastValuesByProviderIds[id];
		this.lastValuesByProviderIds[id] = value;
		if (!isInitialCall && oldValue !== value) {
			this.subscriptionsByProviderIds[id].broadcast(value);
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
		const subscription = new Subscription<Data>();
		this.subscriptionsByProviderIds[id] = subscription;
		return {
			id,
			getLatestValue: () => this.getValue(id),
			subscribe: subscription.subscribe,
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

type IdType = number;
