import { Model } from '../src';

describe("create", () => {
  class Subject extends Model {
    value: number;
  
    constructor(initial?: number){
      super();
      this.value = initial || 1;
    }
  
    setValue = (to: number) => {
      this.value = to;
    }
  }

  it('will instantiate from custom class', () => {
    const state = Subject.create();
  
    expect(state.value).toBe(1);
  })

  it('will send arguments to constructor', () => {
    const state = Subject.create(3);

    expect(state.value).toBe(3);
  })
    
  it('defines get/set as circular references', async () => {
    const state = Subject.create();
    
    expect(state.get.value).toBe(1);
  
    state.set.value = 2;
    await state.update(true);
    
    expect(state.get.value).toBe(2)
  })
})

describe("expectations", () => {
  it("will ignore getters and setters", () => {
    class Test extends Model {
      foo = "foo";

      get bar(){
        return "bar";
      }
    }

    const test = Test.create();

    expect(test.bar).toBe("bar");
    expect(test.export()).not.toContain("bar");
  })
})