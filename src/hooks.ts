import { useRef, useReducer, useLayoutEffect } from "react";
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

		let depsValue = depsRef.current;
		let resultValue = resultRef.current;

		useLayoutEffect(() => {
			depsRef.current = depsValue;
			resultRef.current = resultValue;
		});

		if (!resultValue.called) {
			resultValue = {
				called: true,
				data: fn(),
			};
			return resultValue.data;
		}

		const prevDeps = depsRef.current;
		const haveDepsChanged = !areDepsEqual(prevDeps, deps);
		if (haveDepsChanged) {
			// deps have changed; recalculating output;
			resultValue = {
				called: true,
				data: fn(),
			};
			depsValue = deps;
		}

		return resultValue!.data;
	};
};

export const useForceUpdate = () => {
	const [, forceUpdate] = useReducer(x => x + 1, 0);
	return (forceUpdate as any) as () => void;
};
