# Model Utilities & Type System

## Type Checking with Model.is 

The static is() method validates Model inheritance and enables type-safe static method access:

```typescript
// Base model with static helper
class User extends Model {
  name: string = "User";
}

// Specialized user type
class Admin extends User {
  static prepare(){
    // ...
  }
}

// Generic model processor
function initializeModel(ModelType: typeof Model) {
  // Check and narrow type
  if(User.is(ModelType)) {
    // TypeScript knows this is safe
    return ModelType.new({ name: "New User" });
  }

  if(Admin.is(ModelType)){
    ModelType.prepare();
  }

  return ModelType.new();
}

// Inheritance checks
console.log(Model.is(User))   // true - User extends Model
console.log(User.is(Admin))   // true - Admin extends User  
console.log(Admin.is(User))   // false - User doesn't extend Admin
```

Key points:
- Validates Model inheritance chain
- Enables static method type safety
- Essential for generic Model handling
- Works with abstract classes
- Used by framework adapters

## Global Events with Model.on

Listen to all instances of a Model type and its subclasses:

```typescript
class Vehicle extends Model {
  speed = 0;
}
class Car extends Vehicle {
  doors = 4;
}
class Truck extends Vehicle {
  cargo = 0;
}

// Listens to ALL model instances
Model.on((key, instance) => {
  console.log("Any model updated:", instance);
});

// Listens to Vehicle, Car, and Truck instances
Vehicle.on((key, instance) => {
  console.log("Vehicle or subclass updated:", instance);
});

// Listens to only Car instances
Car.on((key, instance) => {
  if(key === true) {
    console.log("Car created:", instance);
  }
  else if(key === null) {
    console.log("Car destroyed:", instance);
  }
  else {
    console.log(`Car updated: ${String(instance)}, key: ${String(key)}`);
  }
});

const car = Car.new();     // Triggers Model.on, Vehicle.on, Car.on
const truck = Truck.new(); // Triggers Model.on, Vehicle.on
```

Key points:
- Listeners fire for all subclass instances
- Model.on catches all model events
- More specific listeners only get relevant instances
- Events flow down inheritance chain
- Same callback runs once even if registered multiple times
- true = creation, false = update, null = destruction
- string/symbol = property/custom event

Key points:
- Fires for all instance events
- true = instance created
- false = instance updated
- null = instance destroyed
- string/symbol = property/custom event
- Returns cancel function
- Events bubble up inheritance chain
- Same callback only runs once if registered multiple times

## String Representation

Models implement meaningful toString():

```typescript
class Example extends Model {}

// With explicit ID
const model = Example.new("user-profile");
String(model) // => "user-profile"

// Auto-generated ID
const another = Example.new();
String(another) // => "Example-a1b2c3"
```

Key points:
- Explicit IDs take precedence
- Auto IDs use class name + random chars
- Useful for debugging
- Used in error messages
- Works in template literals
- Helps identify instances

## Property Iteration

Models implement Symbol.iterator:

```typescript
class Profile extends Model {
  name = "Alice";
  age = 30;
  email = "alice@example.com";
}

const profile = Profile.new();

// Iterate managed properties
for(const [key, value] of profile) {
  console.log(`${key}: ${value}`);
}

// Convert to entries
const entries = [...profile];
// => [
//   ["name", "Alice"],
//   ["age", 30],
//   ["email", "alice@example.com"]
// ]
```

Key points:
- Iterates managed properties
- Returns [key, value] pairs
- Skips methods/internals
- Works with spread operator
- Useful for inspection/debug
- Helps with serialization