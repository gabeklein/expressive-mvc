import { Context } from '../context';
import { State } from '../state';
import { has } from './has';

describe('debug has', () => {
  it('simple has test', () => {
    class Child extends State {}
    class Parent extends State {
      children = has(Child, (state) => {
        console.log('Parent has callback called with:', state.constructor.name);
      });
    }

    console.log('Creating parent...');
    const parent = Parent.new();
    console.log('Creating child...');
    const child = Child.new();

    console.log('Creating context with parent...');
    const ctx = new Context({ parent });
    console.log('Pushing child to context...');
    ctx.push({ child });

    console.log('Parent.children:', parent.children);
    expect(parent.children).toEqual([child]);
  });
});
