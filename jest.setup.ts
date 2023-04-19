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
  }
})