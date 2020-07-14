type DependencyList = readonly any[];

export const depsShallowEquality = (oldDeps: any[], newDeps: any[]) => {
	if (!Array.isArray(oldDeps) || !Array.isArray(newDeps)) {
		return oldDeps === newDeps;
	}
	if (oldDeps.length !== newDeps.length) return false;
	for (let i = 0; i < oldDeps.length; ++i) {
		if (oldDeps[i] !== newDeps[i]) return false;
	}
	return true;
};

export const areDeeplyEqual = <T1 extends any, T2 extends any>(
	obj1: T1,
	obj2: T2,
	depth = Infinity
): boolean => {
	if ((obj1 as any) === (obj2 as any)) return true;
	if (typeof obj1 !== typeof obj2) return false;
	if (typeof obj1 !== "object" || typeof obj2 !== "object") return false;

	const obj1Keys = Object.keys(obj1 as any).sort();
	const obj2Keys = Object.keys(obj2 as any).sort();
	if (obj1Keys.length !== obj2Keys.length) return false;
	for (let i = 0; i < obj1Keys.length; i++) {
		const key1 = obj1Keys[i];
		const key2 = obj2Keys[i];
		if (key1 !== key2) return false;
		if (obj1[key1] !== obj2[key2]) {
			if (depth <= 1) return false;
			if (!areDeeplyEqual(obj1[key1], obj2[key2], depth - 1)) {
				return false;
			}
		}
	}
	return true;
};

const createDependenciesEqualityFn = (
	equalityFn: (obj1: any, obj2: any) => boolean
) => (previous: DependencyList, current: DependencyList) => {
	if (previous.length !== current.length) return false;
	for (let i = 0; i < previous.length; i++) {
		const prev = previous[i];
		const next = current[i];
		if (prev === next) continue;
		if (!equalityFn(prev, next)) return false;
	}
	return true;
};

export const propsEqualityFactory = (depth: number) => {
	return createDependenciesEqualityFn((obj1, obj2) =>
		areDeeplyEqual(obj1, obj2, depth)
	);
};
