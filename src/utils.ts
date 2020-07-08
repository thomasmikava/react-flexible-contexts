export const createNestDataFn = <
	Args extends readonly (string | number | symbol)[]
>(
	pathKeys: Args
) => {
	return <Data extends any>(data: Data) => {
		return nestData(data, pathKeys);
	};
};

export const nestData = <
	Data extends any,
	Args extends readonly (string | number | symbol)[]
>(
	data: Data,
	pathKeys: Args
): ToNestedObj<Data, Args> => {
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
