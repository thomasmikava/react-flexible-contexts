import { ContextSubscriberHook, ContextSubscraberValue } from "./interfaces";
import React, { useContext, useState, useRef, useLayoutEffect } from "react";
import {
	createMemoHook,
	depsAreShallowlyEqual,
	useForceUpdate,
} from "../hooks";
type DependencyList = ReadonlyArray<any>;

const EMPTY_DEPS = [
	`__$$EMPTY:%$W,w_&te-nw~[rzSETQK5{CB9V?F&+8n_m\nFZB?:fW]Y2QG$$__`,
];

const defaultTransformer = <T>(x: T) => x;
export const createContextSubscriberHook = <Data>(
	context: React.Context<ContextSubscraberValue<Data>>
): ContextSubscriberHook<Data> => {
	function useContextValue();
	function useContextValue<T>(
		fn: (rootData: Data) => T,
		deps?: DependencyList | null
	);
	function useContextValue<T>(
		fn: (rootData: Data) => T,
		areDataEqual?: (prevValue: T, newValue: T) => boolean,
		deps?: DependencyList | null
	);
	function useContextValue<T>(...args: any[]) {
		let areDataEqual: (
			prevValue: T,
			newValue: T
		) => boolean = shallowCompare;
		let deps: DependencyList | null = [];
		const fn: (rootData: Data) => any = args[0]
			? args[0]
			: defaultTransformer;

		if (args.length > 2) {
			if (args[1]) areDataEqual = args[1];
			deps = args[2];
		} else if (args[1] !== undefined) {
			if (Array.isArray(args[1]) || args[1] === null) {
				deps = args[1];
			} else {
				areDataEqual = args[1];
			}
		}
		if (deps === undefined) deps = [];

		const fnRef = useRef(fn);
		fnRef.current = fn;
		const areDataEqualRef = useRef(areDataEqual);
		areDataEqualRef.current = areDataEqual;

		const forceUpdate = useForceUpdate();

		const { getLatestValue, subscribe } = useContext(context);
		const [transformedInitialValue] = useState(() => {
			return fn(getLatestValue());
		});
		const transformedValueRef = useRef(transformedInitialValue);

		useLayoutEffect(() => {
			return subscribe(data => {
				const value = fnRef.current(data);
				if (areDataEqual(transformedValueRef.current, value)) {
					return;
				}
				transformedValueRef.current = value;
				setTimeout(forceUpdate, 1);
			});
		}, [subscribe]);

		useCustomMemoHook(() => {
			const value = fnRef.current(getLatestValue());
			if (areDataEqual(transformedValueRef.current, value)) return;
			transformedValueRef.current = value;
			setTimeout(forceUpdate, 1);
		}, deps || EMPTY_DEPS);

		return transformedValueRef.current;
	}
	(useContextValue as ContextSubscriberHook<Data>).extendHook = function<T>(
		fn: (rootData: Data) => T
	): any {
		const hook = createContextSubscriberHook(context) as any;
		const finalHook = (secFn = defaultTransformer, ...args) => {
			return hook(rootData => secFn(fn(rootData)), ...args);
		};
		finalHook.extendHook = someFn =>
			hook.extendHook(data => someFn(fn(data)));
		return finalHook;
	};
	return useContextValue as any;
};

const shallowCompare = <T>(prev: T, next: T) => {
	return prev === next;
};

const useCustomMemoHook = createMemoHook((oldDeps: any[], newDeps: any[]) => {
	if (oldDeps === EMPTY_DEPS || newDeps === EMPTY_DEPS) return false;
	return depsAreShallowlyEqual(oldDeps, newDeps);
});
