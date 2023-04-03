import { Model } from '../model';

export async function assertDidUpdate(
  model: Model, exists?: boolean){

  const assert = expect(model.on(0)).resolves;

  return exists === false
    ? assert.toBe(false)
    : assert.toBeTruthy();
}

export function subscribeTo<T extends Model>(
  target: T, accessor: (self: T) => void){

  const didTrigger = jest.fn();

  target.on(state => {
    accessor(state);
    didTrigger();
  });

  // ignore initial scan-phase
  didTrigger.mockReset();

  return async (isExpected = true) => {
    await new Promise(res => setTimeout(res, 0));

    if(isExpected){
      expect(didTrigger).toHaveBeenCalled();
      didTrigger.mockReset();
    }
    else
      expect(didTrigger).not.toHaveBeenCalled();
  }
}

export function mockAsync<T = void>(){
  const pending = new Set<[Function, Function]>();

  const event = () => (
    new Promise<T>((res, rej) => {
      pending.add([res, rej]);
    })
  );

  const resolve = (value: T) => {
    const done = event();

    pending.forEach(x => x[0](value));
    pending.clear();

    return done;
  }

  return {
    pending: event,
    resolve
  }
}

export function mockConsole(){
  const warn = jest
    .spyOn(global.console, "warn")
    .mockImplementation(() => {});

  const error = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    warn.mockReset();
    error.mockReset();
  });

  afterAll(() => {
    warn.mockReset();
    error.mockRestore();
  });

  return {
    error,
    warn
  }
}