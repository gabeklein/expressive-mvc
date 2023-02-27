import { get } from './instruction/get';
import { Model } from './model';
import { Oops as Suspense } from './suspense';

it("will seem to throw error outside react", () => {
  class Test extends Model {
    source?: string = undefined;
    value = get(() => this.getValue, true);

    getValue(){
      return this.source;
    }
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