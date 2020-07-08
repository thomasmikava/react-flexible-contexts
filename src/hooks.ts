import { useRef, useReducer } from "react";

type DependencyList = readonly any[];
type EqualityFn = (
	previous: DependencyList,
	current: DependencyList
) => boolean;

export const createMemoHook = (
	areDepsEqual: EqualityFn = depsAreShallowlyEqual
) => {
	const initialResultInfo = {
		called: false,
	} as const;

	return <T>(fn: () => T, deps: DependencyList) => {
		const resultRef = useRef<{ called: false } | { called: true; data: T }>(
			initialResultInfo
		);
		const depsRef = useRef(deps);

		if (!resultRef.current.called) {
			resultRef.current = {
				called: true,
				data: fn(),
			};
			return resultRef.current.data;
		}

		const prevDeps = depsRef.current;
		const haveDepsChanged = !areDepsEqual(prevDeps, deps);
		if (haveDepsChanged) {
			// deps have changed; recalculating output;
			resultRef.current = {
				called: true,
				data: fn(),
			};
			depsRef.current = deps;
		}

		return resultRef.current!.data;
	};
};

export const depsAreShallowlyEqual = (oldDeps: any[], newDeps: any[]) => {
	if (oldDeps.length !== newDeps.length) return false;
	for (let i = 0; i < oldDeps.length; ++i) {
		if (oldDeps[i] !== newDeps[i]) return false;
	}
	return true;
};

export const useForceUpdate = () => {
	const [, forceUpdate] = useReducer(x => x + 1, 0);
	return forceUpdate;
};
