import { set } from './instruction/set';
import { Model } from './model';
import { Oops as Suspense } from './suspense';

it("will seem to throw error outside react", () => {
  class Test extends Model {
    value = set<never>();
  }

  const instance = Test.new();
  const expected = Suspense.NotReady(instance, "value");
  let didThrow: Error | undefined;

  try {
    void instance.value;
  }
  catch(err: any){
    didThrow = err;
  }

  expect(String(didThrow)).toBe(String(expected));
})