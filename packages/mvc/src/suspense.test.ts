import { set } from './instruction/set';
import { Model } from './model';

it("will seem to throw error outside react", () => {
  class Test extends Model {
    value = set<never>();
  }

  const instance = Test.new("ID");
  let didThrow: Error | undefined;

  try {
    void instance.value;
  }
  catch(err: any){
    didThrow = err;
  }

  expect(String(didThrow)).toMatchInlineSnapshot(`"Error: Test-ID.value is not yet available."`);
})

it("will reject if model destroyed before resolved", async () => {
  class Test extends Model {
    value = set<never>();
  }

  const instance = Test.new("ID");
  let didThrow: Promise<any> | undefined;

  try {
    void instance.value;
  }
  catch(err: any){
    didThrow = err;
  }

  instance.null();

  await expect(didThrow).rejects.toThrowError(`Test-ID is destroyed.`);
})