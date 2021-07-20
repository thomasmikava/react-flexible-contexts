import { Subscription } from "simple-subscriptions";
import { useEffect, useReducer } from "react";

export const useReRenderSubscription = (
	subscription: Subscription<() => void, any>
) => {
	const forceUpdate = useForceUpdate();
	useEffect(() => {
		return subscription.subscribe(forceUpdate);
	}, []);
};

export const useForceUpdate = (): (() => void) => {
	const [, forceUpdate] = useReducer(x => x + 1, 0);
	return forceUpdate as any;
};
