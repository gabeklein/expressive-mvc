# Effects System

Effects are a crucial part of Model's reactivity system. They allow you to create managed side effects that respond to state changes.

## Basic Effects

```typescript
class Example extends Model {
  count = 0;
  doubled = 0;
}

const model = Example.new();

// Create an effect
model.get(state => {
  // Only accessed properties trigger updates
  const { count } = state;
  state.is.doubled = count * 2;
});
```

Key points:
- Runs immediately on creation
- Re-runs when accessed properties change 
- Returns cleanup function for teardown

## The Subscription Proxy

Effects receive a proxy of the model that tracks property access:

```typescript
model.get(state => {
  // This property access is tracked
  console.log(state.count);
  
  // This access is NOT tracked 
  console.log(state.is.count);
});
```

Important differences:
- `state` is a proxy that observes property access
- `state.is` is direct reference to model
- Only proxied access triggers updates

## Destructuring Best Practices

Always destructure in effects to make dependencies explicit:

```typescript
// Good - dependencies are clear
model.get(({ count, name }) => {
  console.log(count, name);
});

// Bad - dependencies are hidden
model.get(state => {
  console.log(state.count, state.name);
});
```

This prevents issues with:
- Hidden dependencies
- Conditional property access
- Switch statement edge cases

## Using Model.is

The .is property provides direct model access after destructuring:

```typescript
class Example extends Model {
  source = 0;
  computed = 0;
}

const model = Example.new();

model.get(({ is: example, source }) => {
  // Direct model reference for writes
  example.computed = source * 2;
});
```

Key points:
- Preserves write access after destructure
- Not tracked by subscription system
- Useful for computed properties
- Prevents infinite update loops

## Effect Cleanup

Effects can return a cleanup function:

```typescript
model.get(state => {
  const timer = setInterval(() => {
    console.log(state.count);
  }, 1000);

  // Cleanup runs on:
  // - Next effect run
  // - Model destruction
  return () => clearInterval(timer);
});
```

Cleanup runs when:
- Effect re-runs due to updates
- Model is destroyed (set(null))
- Effect is manually cancelled

## Update Batching

Effects batch multiple property changes:

```typescript
class Example extends Model {
  a = 0;
  b = 0;
  sum = 0;
}

const model = Example.new();

model.get(({ a, b, is }) => {
  is.sum = a + b;
});

// Effect runs once after both updates
model.a = 1;
model.b = 2;
await model.set();

console.log(model.sum); // => 3
```

Important points:
- Updates are synchronous
- Effects batch until next frame
- Await set() to ensure effects complete
- Multiple updates trigger single effect

## Edge Cases & Gotchas

1. Hidden Dependencies:
```typescript
// Bad - dependency on mode hidden in switch
model.get(state => {
  switch(state.mode) {
    case "a": 
      // May miss updates to valueA
      console.log(state.valueA);
      break;
    case "b":
      // May miss updates to valueB
      console.log(state.valueB);
      break;
  }
});

// Good - dependencies explicit
model.get(({ mode, valueA, valueB }) => {
  switch(mode) {
    case "a": 
      console.log(valueA);
      break;
    case "b":
      console.log(valueB);
      break;
  }
});
```

2. Silent Access:
```typescript
model.get(state => {
  // Won't refresh on count changes
  const { count } = state.is;
  
  // Will refresh on count changes
  const { count } = state;
});
```

3. Cleanup Order:
```typescript
model.get(state => {
  return () => console.log("Effect cleanup");
});

model.get(null, () => {
  console.log("Model destroyed");
});

// Prints:
// "Effect cleanup"
// "Model destroyed"
```

## Best Practices

1. Always destructure in effects
2. Make dependencies explicit
3. Use .is for write access
4. Provide cleanup functions
5. Await set() for effect completion
6. Keep effects focused and simple