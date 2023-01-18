const {
  assign,
  create,
  defineProperties,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyNames,
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  values
} = Object;

export {
  assign,
  create,
  defineProperties,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  values
}

export function unique<T>(array: T[]){
  return Array.from(new Set(array));
}