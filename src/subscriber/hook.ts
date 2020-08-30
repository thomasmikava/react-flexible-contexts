import { ContextSelectorHook, ContextSubscraberValue } from "./interfaces";
import React, { useContext, useState, useRef, useLayoutEffect, useEffect } from "react";
import { createMemoHook, useForceUpdate } from "../hooks";
import { depsShallowEquality } from "../equality-functions";
type DependencyList = ReadonlyArray<any>;

const EMPTY_DEPS = [
	`__$$EMPTY:%$W,w_&te-nw~[rzSETQK5{CB9V?F&+8n_m\nFZB?:fW]Y2QG$$__`,
];

const defaultTransformer = <T extends readonly any[]>(...x: T) => x;
export const createContextSelectorHook = <Data extends readonly any[]>(
	context: React.Context<ContextSubscraberValue<Data>>,
	defaultProviderId: number,
	useGettingDefaultValue: () => void
): ContextSelectorHook<Data> => {
	let defaultEqualityFn = globallyDefaultCompare;
	function useContextValue();
	function useContextValue<T>(
		fn: (...rootData: Data) => T,
		deps?: DependencyList | null
	);
	function useContextValue<T>(
		fn: (...rootData: Data) => T,
		areDataEqual?: (prevValue: T, newValue: T) => boolean,
		deps?: DependencyList | null
	);
	function useContextValue<T>(...args: any[]) {
		const [fn, areDataEqual, deps, passedLabel] = getArgs<T, Data>(
			args,
			defaultEqualityFn
		);

		const [label] = useState(passedLabel);
		const fnRef = useRef(fn);
		const areDataEqualRef = useRef(areDataEqual);
		const latestSubscriptionCallbackErrorRef = useRef<any>();

		const forceUpdate = useForceUpdate();

		const { getLatestValue, asyncReverseOrderSubscribe, id } = useContext(context);
		if (id === defaultProviderId) {
			useGettingDefaultValue();
		}
		const [transformedInitialValue] = useState(() => {
			return fn(...getLatestValue());
		});
		const transformedValueRef = useRef(transformedInitialValue);

		let selectedState: T;
		try {
			if (
			  latestSubscriptionCallbackErrorRef.current
			) {
			  selectedState = fn(...getLatestValue());
			} else {
			  selectedState = transformedValueRef.current
			}
		  } catch (err) {
			if (latestSubscriptionCallbackErrorRef.current) {
			  err.message += `\nLabel: ${label}\n`;
			  err.message += `\nThe error may be correlated with this previous error:\n${latestSubscriptionCallbackErrorRef.current.stack}\n\n`
			}
			throw err;
		}

		useLayoutEffect(() => {
			fnRef.current = fn;
			areDataEqualRef.current = areDataEqual;
			transformedValueRef.current = selectedState;
			latestSubscriptionCallbackErrorRef.current = undefined
		});

		useLayoutEffect(() => {
			let isCancelled = false;
			const unsubscribe = asyncReverseOrderSubscribe((...data: Data) => {
				if (isCancelled) return;
				try {
					const value = fnRef.current(...data);
					if (areDataEqual(transformedValueRef.current, value)) {
						return;
					}
					transformedValueRef.current = value;
				} catch (err) {
					// we ignore all errors here, since when the component
					// is re-rendered, the selectors are called again, and
					// will throw again
					latestSubscriptionCallbackErrorRef.current = err;
				}
				setTimeout(() => {
					if (isCancelled) return;
					forceUpdate();
				}, 0);
			}, label);
			return () => {
				isCancelled = true;
				unsubscribe();
			}
		}, [label]);

		useCustomMemoHook(() => {
			const value = fnRef.current(...getLatestValue());
			if (areDataEqual(selectedState, value)) return;
			selectedState = value;
		}, deps);

		return selectedState;
	}
	(useContextValue as ContextSelectorHook<Data>).extendHook = function<
		T extends readonly any[]
	>(fn: (...rootData: Data) => T): any {
		const hook = createContextSelectorHook(
			context,
			defaultProviderId,
			useGettingDefaultValue
		) as any;
		const finalHook = (trans, ...args) => {
			if (!trans) {
				const { fn: eqFn, isDefaultFn } = hook.getEqualityFnInfo();
				return hook(
					(...rootData) => fn(...((rootData as unknown) as Data)),
					isDefaultFn ? depsShallowEquality : eqFn,
					[]
				);
			}
			return hook(
				(...rootData) =>
					trans(...fn(...((rootData as unknown) as Data))),
				...args
			);
		};
		finalHook.setEqualityFn = hook.setEqualityFn;
		finalHook.extendHook = someFn =>
			hook.extendHook((...data) =>
				someFn(...fn(...((data as unknown) as Data)))
			);
		/* const defEq = (...args) => defaultEqualityFn(...args as [any, any]);
		defEq.___isSubscriberDefaultFn = () => {
			return isDefaultEquality(defaultEqualityFn)
		} */
		const copiedEquality = dublicateEqualityFn(useContextValue as any);
		finalHook.setEqualityFn(copiedEquality);
		finalHook.getEqualityFnInfo = () => {
			return {
				fn: copiedEquality,
				isDefaultFn: isDefaultEquality(copiedEquality),
			};
		};
		return finalHook;
	};
	useContextValue.setEqualityFn = equalityFn => {
		defaultEqualityFn = equalityFn;
	};
	(useContextValue as any).getEqualityFnInfo = () => {
		return {
			fn: defaultEqualityFn,
			isDefaultFn: isDefaultEquality(defaultEqualityFn),
		};
	};
	return useContextValue as any;
};

export const dublicateEqualityFn = (useSelector: ContextSelectorHook<any>) => {
	const selectorValueEqualityFn = (prev, next) => {
		return useSelector.getEqualityFnInfo().fn(prev, next);
	};
	selectorValueEqualityFn.___isSubscriberDefaultFn = () => {
		return useSelector.getEqualityFnInfo().isDefaultFn;
	};
	return selectorValueEqualityFn;
};

const shallowCompare = <T>(prev: T, next: T) => {
	return prev === next;
};
shallowCompare.___isSubscriberDefaultFn = () => true;

const isDefaultEquality = (fn: any): boolean => {
	if (typeof fn !== "function") return false;
	if (typeof fn.___isSubscriberDefaultFn !== "function") return false;
	return fn.___isSubscriberDefaultFn();
};

const globallyDefaultCompare = shallowCompare;

const useCustomMemoHook = createMemoHook((oldDeps: any[], newDeps: any[]) => {
	if (oldDeps === EMPTY_DEPS || newDeps === EMPTY_DEPS) return false;
	return depsShallowEquality(oldDeps, newDeps);
});

const getArgs = <T, Data extends readonly any[]>(
	args: any[],
	defaultEqualityFn?: (prevValue: any, newValue: any) => boolean
) => {
	if (isDefaultEquality(defaultEqualityFn)) {
		defaultEqualityFn = undefined;
	}
	let label = undefined as undefined | string;
	if (typeof args[args.length - 1] === "string") {
		label = args[args.length - 1];
		args = args.slice(0, args.length - 1);
	}
	let areDataEqual: (prevValue: T, newValue: T) => boolean =
		defaultEqualityFn || shallowCompare;
	let deps: DependencyList | null = null;
	const fn: (...rootData: Data) => T = args[0] ? args[0] : defaultTransformer;

	if (args.length > 2) {
		if (args[1]) areDataEqual = args[1];
		deps = args[2];
	} else if (args[1] !== undefined) {
		if (Array.isArray(args[1]) || args[1] === null) {
			deps = args[1];
		} else if (typeof args[1] === "function") {
			areDataEqual = args[1];
		}
	}
	if (!args[0]) {
		areDataEqual = defaultEqualityFn || (depsShallowEquality as any);
	}
	return [fn, areDataEqual, deps || EMPTY_DEPS, label] as const;
};
