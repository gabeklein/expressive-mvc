# Model.get Method

The get() method serves several core purposes in state management. This chapter covers the fundamental uses, with effects covered separately.

## Exporting Values

Called without arguments, get() exports current state:

```typescript
class Example extends Model {
  foo = "hello";
  bar = { value: 42 };
  baz = new Child();
}

const model = Example.new();
const state = model.get();
// => { 
//   foo: "hello",
//   bar: { value: 42 },
//   baz: { /* child state */ }
// }
```

Key points:
- Returns frozen object
- Recursive - flattens nested models 
- Skips methods and getters
- Resolves ref values to current state
- Useful for serialization

## Property Access

Get specific property value:

```typescript
class Example extends Model {
  required = "hello";
  optional?: string = undefined;
}

const model = Example.new();

// Basic access
const value = model.get("required");

// With requirement flag
try {
  model.get("optional", true); // throws if undefined
} catch(e) {
  // Error is special Promise that React can catch
  if(e instanceof Promise) {
    // Will resolve when value exists
  }
}

// Optional access
const maybe = model.get("optional", false); // undefined
```

Key points:
- Type safe access
- Can enforce required values
- Integrates with React Suspense
- Works with ref values
- Works with computed values

## Update Callbacks

Listen for specific property changes:

```typescript
class Example extends Model {
  count = 0; 
}

const model = Example.new();

// Watch single property
model.get("count", (key, source) => {
  console.log(`Count is now ${source.count}`);
});

model.count++; // Logs update
```

Key points:
- Only fires on actual changes
- Callback gets key and model
- Can return cleanup function
- Useful for property-specific side effects
- More focused than general effects

## Destroyed State

Check and watch destruction:

```typescript
class Example extends Model {
  value = 42;
}

const model = Example.new();

// Check current state
console.log(model.get(null)); // false

// Watch for destruction
model.get(null, () => {
  console.log("Cleanup time!");
});

model.set(null); // Triggers cleanup
console.log(model.get(null)); // true
```

Key points:
- null checks destroyed state
- Callback runs on destruction
- Useful for cleanup
- State frozen after destruction

## Performance Notes

- Property access is cached
- Update callbacks are efficient
- State export clones objects
- Destroyed state is permanent

Next chapter covers set() method, followed by comprehensive coverage of the effects system.