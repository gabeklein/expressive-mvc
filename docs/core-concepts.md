# Chapter 1: Core Model Fundamentals

## Creating Models

Models are classes that define state shape and behavior. They must extend the base Model class:

```typescript
class MyModel extends Model {
  value = 1;
  text = "hello";
}
```

Important constraints:
- Cannot instantiate base Model class directly
- Cannot instantiate abstract Model classes
- Must use Model.new() instead of constructor for proper initialization
- Properties are defined at declaration, not in constructor

## Properties & Initialization

Properties must be explicitly assigned to be tracked:

```typescript
class Example extends Model {
  // Wrong - not tracked at runtime
  value?: string;

  // Correct - tracked and typed as optional
  name?: string = undefined;

  // Also correct - tracked with default
  count = 0;
}
```

Key points:
- Optional properties must explicitly assign undefined
- Properties are reactive - changes trigger updates
- All properties must be declared at class level
- TypeScript types alone don't register properties

## Constructor & Initialization

Models support flexible initialization through Model.Args:

```typescript
class Example extends Model {
  value = 1;
  text = "hello";

  // Basic constructor passing args through
  constructor(...args: Model.Args) {
    super(args);
  }

  // Constructor with custom initialization
  constructor(...args: Model.Args) {
    super(args, {
      value: 2, // Override default
      text: "override"
    });
  }
}
```

Initialization arguments can include:
- String ID for model instance
- Object with property assignments
- Lifecycle callback functions
- Arrays of the above

Example usage:
```typescript
// With string ID
const model = Example.new("my-instance");

// With property assignments
const model = Example.new({ value: 5 });

// With lifecycle function
const model = Example.new(() => {
  console.log("Initialized");
  return () => console.log("Cleanup");
});

// Multiple arguments
const model = Example.new(
  "my-instance",
  { value: 5 },
  () => console.log("Ready")
);
```

Important points about initialization order:
- Arguments are processed in order provided
- Later assignments override earlier ones
- IDs are overridden by later IDs
- Lifecycle functions run in order provided
- Cleanup functions run in reverse order

## Methods & Binding

Methods are automatically bound to their instance:

```typescript
class Counter extends Model {
  count = 0;

  // Methods auto-bind to instance
  increment() { 
    this.count++;
  }

  // Arrow function works but not needed
  decrement = () => {
    this.count--;
  }
}

const counter = Counter.new();
const { increment } = counter;

// Works! 'this' is preserved
increment(); 
```

Key points:
- Methods automatically preserve 'this' context
- Arrow functions work but aren't required
- Methods can be destructured safely
- Perfect for event handlers in React
- Methods aren't tracked (covered in state chapter)

## Lifecycle Management 

Models have a defined lifecycle:

```typescript
class Example extends Model {
  constructor(...args: Model.Args) {
    super(() => {
      // Called when model fully initialized
      console.log("Model ready");

      return () => {
        // Called when model destroyed
        console.log("Cleanup");  
      }
    });
  }
}
```

Creation patterns:
```typescript
// Correct - creates and initializes
const model = Example.new();

// Incorrect - initialization skipped
const model = new Example(); 
```

## TypeScript Integration

While TypeScript isn't required, the library is designed for strong typing:

```typescript
class Example extends Model {
  // Properties are properly typed
  count = 0;
  name?: string = undefined;
  items: string[] = [];

  // Methods preserve parameter types
  addItem(item: string) {
    this.items.push(item);
  }
}

// Args type provided for constructors
constructor(...args: Model.Args<Example>) {
  super(args);
}
```

Benefits:
- Full type inference for properties
- Method parameter typing
- Constructor argument typing
- Property assignment validation
- Optional property handling

## Debugging

Models provide tools for debugging:

1. String representation:
```typescript
const model = Example.new("my-id");
String(model) // => "my-id" or "Example-a1b2c3" if no ID
```

2. Property iteration:
```typescript
for (const [key, value] of model) {
  console.log(`${key}: ${value}`);
}
```

## Best Practices

1. State Definition:
- Always explicitly assign optional properties
- Define all properties at class level
- Initialize with sensible defaults
- Use proper TypeScript types

2. Construction:
- Always use Model.new() not constructor
- Consider providing instance IDs for debugging
- Order initialization args logically
- Clean up resources in lifecycle functions

3. Methods:
- Rely on automatic method binding
- Use proper TypeScript types
- Handle async operations properly
- Clean up resources where needed

4. Error Prevention:
- Check for undefined optional values
- Handle async errors appropriately
- Clean up resources on unmount
- Use TypeScript for type safety