import { Context } from '../context';
import { State } from '../state';
import { get } from './get';

describe('debug recipient mode', () => {
  it('simple recipient test', () => {
    class Child extends State {
      parents = get((state, child) => {
        console.log('Child APPLY called with:', state.constructor.name, 'child:', child);
      });
    }
    class Parent extends State {
      children = get(Child, (state, child) => {
        console.log('Parent callback called with:', state.constructor.name, 'child:', child);
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

    console.log('Child.parents:', child.parents);
    expect(child.parents).toEqual([parent]);
  });
});
