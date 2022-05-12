import { Model } from "./adapter";

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

describe("basics", () => {
  it('will instantiate from custom class', () => {
    const state = Subject.create();
  
    expect(state.value).toBe(1);
  })

  it('will send create() arguments to constructor', () => {
    const state = Subject.create(3);

    expect(state.value).toBe(3);
  })

  it('will update when a value changes', async () => {
    const state = Subject.create();
    
    expect(state.value).toBe(1);

    state.value = 2
    await state.update(true);

    expect(state.value).toBe(2);
  })

  it('will not update if value is same', async () => {
    const state = Subject.create();
    
    expect(state.value).toBe(1);

    state.value = 1
    await state.update(false);
  })
  
  it('accepts update from within a method', async () => {
    const state = Subject.create();
    
    state.setValue(3);
    await state.update(true);

    expect(state.value).toBe(3)
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