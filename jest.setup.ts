import Model from "@expressive/mvc";

const cache = new Set<Model>();

afterEach(() => {
  for(const model of cache)
    model.set(null);

  cache.clear();
});

Model.on(function(){
  cache.add(this);
  return null;
});

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