import Model from "@expressive/mvc";

expect.extend({
  toUpdate,
  toHaveUpdated
});

async function toUpdate(received: Model, timeout = 0){
  return new Promise<jest.CustomMatcherResult>((resolve) => {
    const removeListener = received.set(() => {
      clearTimeout(timer);
      return () => {
        resolve({
          pass: true,
          message: () => `Expected ${received} not to update.`
        })
      };
    });

    const timer = setTimeout(() => {
      removeListener();
      resolve({
        pass: false,
        message: () => `Expected ${received} to update within ${timeout}ms.`
      });
    }, timeout);
  })
}

async function toHaveUpdated(received: Model, ...keys: string[]){
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