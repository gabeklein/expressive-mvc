import { Model } from "@expressive/mvc";

expect.extend({
  async toUpdate(received: Model, ...keys: string[]){
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
  
    const got = Object.keys(didUpdate);
    const equal = JSON.stringify(got.sort()) === JSON.stringify(keys.sort());
  
    return equal ? {
      pass: true,
      message: () =>
        `Expected ${received} not to have updated keys [${keys.join(", ")}].`
    } : {
      pass: false,
      message: () =>
        `Expected ${received} to have updated keys [${keys.join(", ")}] but got [${got.join(", ")}].`
    };
  }
})