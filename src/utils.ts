import { useMemo } from "react";

export const createNestDataFn = <
	Args extends readonly (string | number | symbol)[]
>(
	pathKeys: Args
) => {
	return <Data extends any>(data: Data) => {
		return nestData(data, pathKeys);
	};
};

export const createNestDataHook = <
	Args extends readonly (string | number | symbol)[]
>(
	pathKeys: Args
) => {
	return <Data extends any>(data: Data) => {
		return useNestedData(data, pathKeys);
	};
};

type nestDataFnType = <
	Data extends any,
	Args extends readonly (string | number | symbol)[]
>(
	data: Data,
	pathKeys: Args
) => ToNestedObj<Data, Args>;

export const nestData: nestDataFnType = (data, pathKeys) => {
	if (pathKeys.length < 1) return data as any;
	const obj: any = {};
	let lastObj = obj;
	for (let i = 0; i < pathKeys.length; i++) {
		const key = pathKeys[i];
		lastObj[key] = {};
		if (i === pathKeys.length - 1) {
			lastObj[key] = data;
		}
		lastObj = lastObj[key];
	}
	return obj;
};

export const useNestedData: nestDataFnType = (data, pathKeys) => {
	return useMemo(() => nestData(data, pathKeys), [data, ...pathKeys]);
};

type ToNestedObj<
	T extends unknown,
	Args extends readonly (string | number | symbol)[]
> = Args[0] extends string | number | symbol
	? {
			[key in Args[0]]: ToNestedObj<T, dropFirst<Args>>;
	  }
	: T;

type dropFirst<T extends readonly unknown[]> = ((...args: T) => any) extends (
	arg: any,
	...rest: infer U
) => any
	? U
	: T;

export type MergeDecisionFn = (
	path: string,
	leftVal: any,
	rightVal: any
) => Decision;

interface Decision {
	skip: boolean;
}

export function createDeepMergeFn({
	mergeStrategy,
	decisionFn,
}: {
	mergeStrategy: "overrideLeftToRight" | "overrideRightToLeft";
	decisionFn?: MergeDecisionFn;
}) {
	return function merge<
		T1 extends Record<any, any>,
		T2 extends Record<any, any>
	>(object1: T1, object2: T2, path?: string): T1 & T2 {
		const obj1 = { ...object1 } as any;
		for (const p in object2) {
			const propPath = (path ? path + "." : "") + p;
			if (!object2.hasOwnProperty(p)) continue;
			if (object2[p] === obj1[p]) continue;
			if (!obj1.hasOwnProperty(p)) {
				if (object2[p] !== undefined) {
					obj1[p] = object2[p];
				}
				continue;
			}
			if (decisionFn) {
				const { skip } = decisionFn(propPath, object1, object2);
				if (skip) continue;
			}

			if (object2[p].constructor === Object) {
				obj1[p] = merge(obj1[p], object2[p], propPath) as any;
			} else {
				if (mergeStrategy === "overrideLeftToRight") {
					if (!obj1.hasOwnProperty(p)) {
						obj1[p] = object2[p] as any;
					}
				} else if (mergeStrategy === "overrideRightToLeft") {
					obj1[p] = object2[p] as any;
				}
			}
			if (obj1[p] === undefined) delete obj1[p];
		}

		return obj1;
	};
}
