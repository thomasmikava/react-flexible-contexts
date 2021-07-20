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
