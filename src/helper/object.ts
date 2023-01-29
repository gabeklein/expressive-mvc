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

export function assignWeak(into: any, from: any){
  for(const K in from)
    if(K in into)
      into[K] = from[K];
}