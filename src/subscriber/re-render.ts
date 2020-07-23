import { Subscription } from "./subscription";
import { useEffect, useReducer } from "react";

export const useReRenderSubscription = (subscription: Subscription<[], any>) => {
    const forceUpdate = useForceUpdate();
    useEffect(() => {
        return subscription.subscribe(forceUpdate);
    }, []);
}


const useForceUpdate = (): (() => void) => {
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    return forceUpdate as any;
}
