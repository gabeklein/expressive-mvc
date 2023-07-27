import { Model } from "@expressive/mvc";

expect.extend({
  async toUpdate(received: Model){
    const didUpdate = await received.set();

    return didUpdate ? {
      pass: true,
      message: () => `Expected ${received} not to have pending updates.`
    } : {
      pass: false,
      message: () => `Expected ${received} to have pending updates.`
    };
  },

  async toHaveUpdated(received: Model, ...keys: string[]){
    const didUpdate = await received.set();

    if(!didUpdate)
      return {
        pass: false,
        message: () => `Expected ${received} to have pending updates.`
      }

    const got = Object.keys(didUpdate);
    const equal = JSON.stringify(got.sort()) === JSON.stringify(keys.sort());

    return equal ? {
      pass: true,
      message: () => (
        `Expected ${received} not to have updated keys [${keys.join(", ")}].`
      )
    } : {
      pass: false,
      message: () => (
        `Expected ${received} to have updated keys [${keys.join(", ")}] but got [${got.join(", ")}].`
      )
    };
  }
})