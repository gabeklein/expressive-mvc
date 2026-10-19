import { describe, expect, it } from 'vitest';

import { Component, Model } from '@expressive/mvc';
import { render } from '../index';
import { flushMicrotasks, mount } from '../../test.setup';
import { vnode } from '../node/vnode';

describe('mount', () => {
  it('will render SVG, fragments and primitive updates', async () => {
    class Shapes extends Component {
      count: number | bigint = 1;

      render() {
        return (
          <>
            text:{this.count}
            <label htmlFor="shape">shape</label>
            <svg viewBox="0 0 10 10" {...({ focusable: true } as any)}>
              <circle
                {...({ class: 'legacy' } as any)}
                className="shape"
                cx={5}
                cy={5}
                r={4}
                style={['active', { opacity: 0.5 }]}
              />
            </svg>
            {false}
          </>
        );
      }
    }

    const [shapes, root] = mount(Shapes);

    expect(root.textContent).toBe('text:1shape');
    expect(root.querySelector('circle')?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(root.querySelector('circle')?.getAttribute('class')).toBe('shape active');
    expect((root.querySelector('circle') as SVGCircleElement).style.opacity).toBe('0.5');
    expect(root.querySelector('label')?.getAttribute('for')).toBe('shape');
    expect(root.querySelector('svg')?.getAttribute('focusable')).toBe('');

    shapes.count = 2n;
    await flushMicrotasks();
    expect(root.textContent).toBe('text:2shape');
  });

  it('will reject unsupported render values and element types', () => {
    const root = document.createElement('main');

    expect(() => render({} as never, root)).toThrow('Cannot render');
    expect(() => render(vnode(Symbol('unknown'), {}), root)).toThrow('Cannot render');
    expect(root.textContent).toBe('');
  });

  it('will throw if a Model class is rendered as an element', () => {
    class Bare extends Model {}

    // @ts-expect-error a Model is not a JSX element
    expect(() => render(<Bare />, document.createElement('main'))).toThrow(
      'Bare is a Model - extend Component to render it, or provide it with <Component for={Bare}>.'
    );
  });

  it('will throw if a Model instance is placed inline', () => {
    class Bare extends Model {}
    const bare = Bare.new();

    expect(() => render(<div>{bare as never}</div>, document.createElement('main'))).toThrow(
      'Bare is a Model - extend Component to render it, or provide it with <Component for={Bare}>.'
    );
    bare.set(null);
  });
});
