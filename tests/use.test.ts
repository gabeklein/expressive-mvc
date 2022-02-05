import { Model, use } from './adapter';

describe("use", () => {
  const WORLD = "Hello World!";

  class Parent extends Model {
    hello?: string = undefined;

    child = use(Child as any, (child: any) => {
      this.hello = child.hello;
    }) as Child;
  }

  class Child extends Model {
    hello = WORLD;
  }

  let parent: Parent;

  beforeAll(() => {
    parent = Parent.create();
  })

  it('will create instance of child', () => {
    expect(parent.child).toBeInstanceOf(Child);
  })

  it('will run child callback on create', () => {
    expect(parent.hello).toBe(WORLD);
  })
})