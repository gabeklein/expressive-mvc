# Model.set Method

The set() method handles state updates and their lifecycle. This chapter covers core functionality, with effects covered separately.

## Update Queue

Called without arguments, returns current update status:

```typescript
class Example extends Model {
  count = 0;
}

const model = Example.new();

model.count++; // Queue update

const pending = model.set();
if(pending) {
  // Updates are queued
  const keys = await pending; // ["count"]
}
```

Key points:
- Returns undefined if no updates
- Returns promise if updates pending
- Promise resolves to changed keys
- Updates are synchronous
- Promise signals effect completion

## Property Updates

Force update specific property:

```typescript
class Example extends Model {
  items: string[] = [];
  
  addItem(item: string) {
    this.items.push(item);
    // Array reference unchanged, force refresh
    this.set("items");
  }
}
```

Key points:
- Forces subscribers to update
- Useful for reference types
- Can use symbols as events
- Returns update promise

## Batch Assignment

Apply multiple property changes:

```typescript
class Example extends Model {
  x = 0;
  y = 0;
  z = 0;
}

const model = Example.new();

// Normal update
model.set({
  x: 10,
  y: 20
});

// Silent update (no notifications)
model.set({ z: 30 }, true);
```

Key points:
- Updates multiple properties
- Ignores unknown properties
- Optional silent updates
- Returns update promise
- Type safe assignments

## Update Callbacks

Watch all model updates:

```typescript
class Example extends Model {
  count = 0;
}

const model = Example.new();

const cancel = model.set((key, source) => {
  console.log(`Updated ${key}`);
  
  // Optional callback after frame
  return () => {
    console.log("Update complete");
  }
});

// Stop watching
cancel();
```

Key points:
- Fires for all property changes
- Gets key and model reference
- Can cleanup after update
- Returns cancel function

## Model Destruction

Permanently disable model:

```typescript
const model = Example.new();

// Watch for destruction
model.get(null, () => {
  console.log("Cleanup!");
});

// Destroy model
model.set(null);

// Throws: "Model is destroyed"
model.count = 1;
```

Key points:
- Cleanup runs on destruction
- All updates blocked after
- Operation is permanent
- Prevents memory leaks

## Custom Events

The set() method can dispatch events not tied to properties:

```typescript
class Example extends Model {
  value = 0;
}

const model = Example.new();

// Symbol events (recommended)
const REFRESH = Symbol("refresh");
model.set(REFRESH);

// String events 
model.set("!custom-event");
// Use prefix like ! to avoid property collisions

// Number events
model.set(42);

// Watch any event
model.set((key, source) => {
  if(key === REFRESH) {
    // Handle refresh
  }
});
```

Key points:
- Events can be symbols/strings/numbers
- Symbols prevent name collisions
- String events should use prefix
- Events trigger callbacks/effects
- Useful for custom signals

## Update Process

Updates follow a defined lifecycle:

1. Property changed (sync)
2. Update queued
3. Next frame:
   - Callbacks fire
   - Effects process
   - Promises resolve

```typescript
model.count = 1; // Immediate 
model.x = 2; // Immediate

// Wait for effects
await model.set();

// All effects complete
```

Key points:
- Properties update immediately
- Effects batch until frame
- await set() for completion
- Multiple updates = one effect

## Performance Notes

- Updates are synchronous
- Effects batch efficiently
- Silent updates skip processing
- Destruction cleans memory

Next chapter covers the effects system in detail.