import { Model } from "@expressive/mvc";

expect.extend({
  async toUpdate(received: Model){
    const didUpdate = await received.on(0);

    return didUpdate ? {
      pass: true,
      message: () => `Expected ${received} not to have pending update.`
    } : {
      pass: false,
      message: () => `Expected ${received} to have a pending update.`
    };
  },

  async toHaveUpdated(received: Model, keys: string[]){
    const didUpdate = await received.on(0);
    const equal = JSON.stringify(didUpdate) === JSON.stringify(keys);

    return equal ? {
      pass: true,
      message: () => {
        return `Expected ${received} not to have updated keys [${keys.join(", ")}].`;
      }
    } : {
      pass: false,
      message: () => {
        const expected = keys.join(", ");
        const actual = didUpdate ? `[${didUpdate.join(", ")}]` : "no update" 

        return `Expected ${received} to have updated keys [${expected}] but got ${actual}.`;
      }
    };
  }
})