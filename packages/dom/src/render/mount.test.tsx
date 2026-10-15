import { describe, expect, it } from 'vitest';

import { Component, State } from '@expressive/mvc';
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
    class Bare extends State {}
    const root = document.createElement('main');

    expect(() => render({} as never, root)).toThrow('Cannot render');
    expect(() => render(vnode(Symbol('unknown'), {}), root)).toThrow('Cannot render');
    expect(() => render(<div>{Bare.new() as never}</div>, root)).toThrow('Cannot render');
    expect(root.textContent).toBe('');
  });
});
