
export function mockAsync<T = void>() {
  const pending = new Set<[Function, Function]>();

  const event = () => new Promise<T>((res, rej) => pending.add([res, rej]));

  const resolve = (value: T) => {
    const done = event();

    pending.forEach(x => x[0](value));
    pending.clear();

    return done;
  };

  return {
    pending: event,
    resolve
  };
}
