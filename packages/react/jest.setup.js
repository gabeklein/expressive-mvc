import { Model } from "@expressive/mvc";

expect.extend({
  toHaveUpdated
});

/**
 * @param {Model} received
 * @param {string[]} keys
 */
async function toHaveUpdated(received, ...keys){
  if(!(received instanceof Model))
    return {
      pass: false,
      message: () => `Expected Model but got ${received}.`
    }

  const didUpdate = await received.set();

  if(!didUpdate)
    return {
      pass: false,
      message: () => `Expected ${received} to have pending updates.`
    }

  if(!keys.length)
    return {
      pass: true,
      message: () => `Expected ${received} not to have pending updates.`
    }

  for(const key of keys)
    if(!didUpdate.includes(key))
      return {
        pass: false,
        message: () => {
          return `Expected ${received} to have updated keys [${keys.map(String).join(", ")}] but got [${didUpdate.join(", ")}].`
        }
      }

  return {
    pass: true,
    message: () =>
      `Expected ${received} not to have updated keys [${keys.map(String).join(", ")}].`
  }
}