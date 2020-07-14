# React flexible contexts

The goal of this project is to increase flexibility of native context API in react.


## Dynamic Context
TL; DR: allows optimizing consuming context without much effort.

Let's consider examples when we want to have context with value of type
```ts
type Value = {
    firstname: string;
    lastname: string;
    setFirstname: (firstname: string) => void;
    setLastname: (lastname: string) => void;
}
```

Creating Dynamic context:
```tsx
import { DynamicContext } from "react-flexible-contexts";

const UserContext = DynamicContext.create<Value>(); // you can pass default value too but it is not required

const ParentComponent = () => {
	const [firstname, setFirstname] = useState("Nick");
	const [lastname, setLastname] = useState("Fury");

	return (
		<UserContext
			value={{ firstname, lastname, setFirstname, setLastname }}
		>
			<ChildComponent />
		</UserContext>
	);
};
```

Or you can create destructured context
```tsx
import { DynamicContext } from "react-flexible-contexts";

const UserDestructuredContext = DynamicContext.createDestructured<Value>(); // you can pass default value too but it is not required

const ParentComponent = () => {
	const [firstname, setFirstname] = useState("Nick");
	const [lastname, setLastname] = useState("Fury");

	return (
		<UserContext
			firstname={firstname}
			lastname={lastname}
			setFirstname={setFirstname}
			setLastname={setLastname}
		>
			<ChildComponent />
		</UserContext>
	);
};
```

Consuming dynamic context:
```tsx
const DescendantComponent = () => {
	const {
		firstname,
		lastname,
		setFirstname,
		setLastname,
	} = UserContext.useValue();

	return (
		<div>
			Hello {firstname} {lastname}
		</div>
	);
};
```

If you do not need whole context, you can optimize effortesly:
```tsx
const DescendantComponent = () => {
	const firstname = UserContext.useSubscriber(val => val.firstname, []); // the array is for dependency list

	const [minLength, setMinLength] = useState(5);
	// if minLength changes, the passed function will be called anyway to ensure consistent data
	const isLastnameLongEnough = UserContext.useSubscriber(
		val => val.lastname >= minLength,
		[minLength]
	);

	return <div>Hello {firstname}</div>;
};
```

You can take optimization even further
```tsx
const DescendantComponent = () => {
	const { firstname, setFirstname } = UserContext.useSubscriber(
		val => ({ firstname: val.firstname, setFirstname: val.setFirstname }),
		(prev, next) =>
			prev.firstname === next.firstname &&
			prev.setFirstname === next.setFirstname,
		[]
	);

	return <div>Hello {firstname}</div>;
};
```

You can add internal contexts without explicitely passing values
```tsx
const FirstnameContext = UserContext.addInternalContext(val => {
	return useMemo( // for optimization
		() => ({ firstname: val.firstname, setFirstname: val.firstname }),
		[val.firstname, val.firstname]
	);
});


// Since we are using UserContext in parent component, there is no need to use provider of FirstnameContext. the value will be provided internally.
// Note that FirstnameContext is an instance of DynamicContext and has every property that UserContext has.


const DescendantComponent = () => {
	const { firstname, setFirstname } = FirstnameContext.useValue();

	return <div>Hello {firstname}</div>;
};

```

## Stacked Context
TL; DR: allows taking into consideration ancestor providers instead of only the closest one.

Creating StackedContext context:
```tsx
import { StackedContext } from "react-flexible-contexts";

const StackedUser = StackedContext.create<Value>(); // you can pass default value too but it is not required
const UserRootProvider = StackedUser.context.Provider;

const UserMiddleProvider = StackedUser.addProvider(
	(current: Partial<Value>, prev: Value) => ({ ...prev, ...current })
);

const ParentComponent = () => {
	const [firstname, setFirstname] = useState("Nick");
	const [lastname, setLastname] = useState("Fury");

	return (
		<UserRootProvider
			value={{ firstname, lastname, setFirstname, setLastname }}
		>
			<UserMiddleProvider value={{ firstname: firstname + "!" }}>
				<ChildComponent />
			</UserMiddleProvider>
		</UserRootProvider>
	);
};

```
