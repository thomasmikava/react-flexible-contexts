import { useRef, useReducer } from "react";
import { depsShallowEquality } from "./equality-functions";

type DependencyList = readonly any[];
type EqualityFn = (
	previous: DependencyList,
	current: DependencyList
) => boolean;

export const createMemoHook = (
	areDepsEqual: EqualityFn = depsShallowEquality
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

export const useForceUpdate = () => {
	const [, forceUpdate] = useReducer(x => x + 1, 0);
	return (forceUpdate as any) as () => void;
};
