const {
  assign,
  create,
  defineProperties,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  values
} = Object;

/** Random alphanumberic of length 6; will always start with a letter. */
function random(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  assign,
  create,
  defineProperties,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  values,
  random
}