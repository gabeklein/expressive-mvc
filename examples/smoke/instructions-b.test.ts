import { fireEvent, within } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { act, mount, norm, RENDERER, settle } from './harness';

const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => [...root.querySelectorAll<T>(sel)];
const text = (el: Element | null) => norm(el?.textContent ?? null);

/** happy-dom has no layout: give the drag surface and box real geometry. */
function layout(surface: HTMLElement, box: HTMLElement) {
  const translate = () => {
    const [, x = '0', y = '0'] = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(box.style.transform) ?? [];
    return { x: +x, y: +y };
  };
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;

  surface.getBoundingClientRect = () => rect(0, 0, 480, 272);
  box.getBoundingClientRect = () => { const { x, y } = translate(); return rect(x, y, 80, 80); };
  Object.defineProperty(box, 'offsetWidth', { configurable: true, get: () => 80 });
  Object.defineProperty(box, 'offsetHeight', { configurable: true, get: () => 80 });
  box.setPointerCapture = () => {};
}

const pointer = {
  async down(el: Element, clientX: number, clientY: number) {
    await act.fire(() => fireEvent.pointerDown(el, { clientX, clientY, pointerId: 1 }));
  },
  async move(el: Element, clientX: number, clientY: number) {
    await act.fire(() => fireEvent.pointerMove(el, { clientX, clientY, pointerId: 1 }));
  },
  async up(el: Element) {
    await act.fire(() => fireEvent.pointerUp(el, { pointerId: 1 }));
  }
};

describe('instructions/map-insert', () => {
  it('will bump, add and clamp entries', async () => {
    const page = await mount('instructions/map-insert');
    const rows = () => $$(page.container, '.stock li').map(li => [text($(li, '.name')), text($(li, 'output'))]);
    const row = (name: string) => $$(page.container, '.stock li').find(li => text($(li, '.name')) == name)!;
    const footer = () => text($(page.container, 'footer small'));
    const input = page.getByPlaceholderText('Add or bump an item…') as HTMLInputElement;

    expect(rows()).toEqual([['apples', '3'], ['bread', '1'], ['milk', '2']]);
    expect(footer()).toBe('3 items · 6 in stock');

    await act.click(within(row('apples')).getByText('+'));
    expect(rows()).toEqual([['apples', '4'], ['bread', '1'], ['milk', '2']]);
    expect(footer()).toBe('3 items · 7 in stock');

    await act.click(within(row('bread')).getByText('−'));
    await act.click(within(row('bread')).getByText('−'));
    expect(rows()).toEqual([['apples', '4'], ['bread', '0'], ['milk', '2']]);
    expect(footer()).toBe('3 items · 6 in stock');

    await act.type(input, '  Milk ');
    expect(input.value).toBe('  Milk ');
    await act.submit(input.form!);
    expect(input.value).toBe('');
    expect(rows()).toEqual([['apples', '4'], ['bread', '0'], ['milk', '3']]);
    expect(footer()).toBe('3 items · 7 in stock');

    await act.type(input, 'Eggs');
    await act.click(page.getByText('Add'));
    expect(input.value).toBe('');
    expect(rows()).toEqual([['apples', '4'], ['bread', '0'], ['milk', '3'], ['eggs', '1']]);
    expect(footer()).toBe('4 items · 8 in stock');

    await act.type(input, '   ');
    await act.submit(input.form!);
    expect(input.value).toBe('   ');
    expect(footer()).toBe('4 items · 8 in stock');
  });
});

describe('instructions/ref', () => {
  it('will drag the box through its ref', async () => {
    const page = await mount('instructions/ref');
    const surface = $(page.container, '.surface');
    const box = $(page.container, '.box');
    layout(surface, box);

    expect(box.className).toBe('box');
    expect(box.style.transform).toBe('translate(72px, 64px)');
    expect(text(box)).toBe('72, 64');

    await pointer.move(box, 300, 300);
    expect(text(box)).toBe('72, 64');

    await pointer.down(box, 82, 74);
    expect(box.className).toBe('box dragging');

    await pointer.move(box, 210, 150);
    expect(box.style.transform).toBe('translate(200px, 140px)');
    expect(text(box)).toBe('200, 140');

    await pointer.move(box, 1000, -50);
    expect(text(box)).toBe('400, 0');

    await pointer.move(box, 100.6, 100.2);
    expect(text(box)).toBe('91, 90');

    await pointer.up(box);
    expect(box.className).toBe('box');

    await pointer.move(box, 300, 200);
    expect(text(box)).toBe('91, 90');
  });

  it('will attach and detach a ref with the node', async () => {
    const log: string[] = [];
    const container = document.createElement('div');
    document.body.append(container);

    const react = RENDERER == 'react';
    const mvc = await (react ? import('@expressive/react') : import('@expressive/mvc'));
    const h: (type: any, props: any) => unknown = react
      ? (await import('react')).createElement
      : (await import('@expressive/dom/jsx-runtime')).jsx;

    let probe!: Probe;
    class Probe extends mvc.Component {
      show = true;
      protected new() { probe = this; }
      node = mvc.ref<HTMLElement>((el) => {
        log.push(`attach ${el.tagName}`);
        return (next) => log.push(`release ${next ? next.tagName : next}`);
      });
      plain = mvc.ref<HTMLElement>();

      render() {
        const el = this.show ? h('b', { ref: this.node, children: 'on' }) : h('i', { children: 'off' });
        return h('div', { ref: this.plain, children: el });
      }
    }

    let unmount: () => unknown;
    const run = async (fn: () => unknown) => {
      if (react) {
        const { act } = await import('react');
        await act(async () => { await fn(); });
      } else await fn();
      await settle();
    };

    if (react) {
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);
      await run(() => root.render(h(Probe, {}) as any));
      unmount = () => root.unmount();
    } else {
      const { render } = await import('@expressive/dom');
      await run(() => { unmount = render(h(Probe, {}) as any, container); });
    }

    expect(log).toEqual(['attach B']);
    expect(probe.node.current).toBe(container.querySelector('b'));
    expect(probe.plain.current).toBe(container.querySelector('div'));

    await run(() => { probe.show = false; });
    expect(container.textContent).toBe('off');
    expect(probe.node.current).toBe(null);
    expect(log).toEqual(['attach B', 'release null']);

    await run(() => { probe.show = true; });
    expect(probe.node.current).toBe(container.querySelector('b'));
    expect(log).toEqual(['attach B', 'release null', 'attach B']);

    await run(() => unmount());
    expect(probe.node.current).toBe(null);
    expect(probe.plain.current).toBe(null);
    expect(log).toEqual(['attach B', 'release null', 'attach B', 'release null']);
  });
});

describe('instructions/ref-multiple', () => {
  it('will wire every fader from the state keys', async () => {
    const page = await mount('instructions/ref-multiple');
    const labels = () => $$(page.container, '.desk label');
    const values = () => labels().map(l => [text($(l, 'span')), $<HTMLInputElement>(l, 'input').value, text($(l, 'output'))]);
    const fader = (name: string) => $<HTMLInputElement>(labels().find(l => text($(l, 'span')) == name)!, 'input');

    expect(values()).toEqual([
      ['bass', '40', '40'], ['mids', '65', '65'], ['treble', '30', '30'], ['air', '55', '55']
    ]);
    for (const input of $$<HTMLInputElement>(page.container, '.desk input')) {
      expect(input.type).toBe('range');
      expect(input.min).toBe('0');
      expect(input.max).toBe('100');
    }

    await act.type(fader('mids'), '80');
    expect(values()[1]).toEqual(['mids', '80', '80']);

    await act.click(page.getByText('+10 all'));
    expect(values()).toEqual([
      ['bass', '50', '50'], ['mids', '90', '90'], ['treble', '40', '40'], ['air', '65', '65']
    ]);

    await act.click(page.getByText('+10 all'));
    expect(values().map(v => v[2])).toEqual(['60', '100', '50', '75']);

    await act.click(page.getByText('−10 all'));
    expect(values().map(v => v[2])).toEqual(['50', '90', '40', '65']);

    await act.click(page.getByText('Flatten'));
    expect(values()).toEqual([
      ['bass', '50', '50'], ['mids', '50', '50'], ['treble', '50', '50'], ['air', '50', '50']
    ]);

    await act.type(fader('air'), '0');
    await act.click(page.getByText('−10 all'));
    expect(values().map(v => v[2])).toEqual(['40', '40', '40', '0']);
    expect(fader('air').value).toBe('0');
  });
});

describe('instructions/set', () => {
  it('will reject long names and debounce the search', async () => {
    const page = await mount('instructions/set');
    const [name, query] = $$<HTMLInputElement>(page.container, 'input');
    const result = () => text($(page.container, '.result'));

    expect(name.value).toBe('guest');
    expect(query.value).toBe('');
    expect(result()).toBe('idle');

    await act.type(name, 'Ada Lovelace');
    expect(name.value).toBe('Ada Lovelace');

    await act.type(name, 'Ada Lovelace!');
    expect(name.value).toBe('Ada Lovelace');

    await act.type(name, 'Ada');
    expect(name.value).toBe('Ada');

    await act.type(query, 'ex');
    expect(query.value).toBe('ex');
    expect(result()).toBe('typing…');

    await act.fire(() => {}, 200);
    await act.type(query, 'expr');
    expect(result()).toBe('typing…');

    await act.fire(() => {}, 350);
    expect(result()).toBe('typing…');

    await act.fire(() => {}, 250);
    expect(result()).toBe('searching “expr”');

    await act.type(query, '');
    expect(result()).toBe('typing…');
    await act.fire(() => {}, 550);
    expect(result()).toBe('idle');
  });
});

describe('instructions/set-computed', () => {
  it('will recompute totals from each input', async () => {
    const page = await mount('instructions/set-computed');
    const [hours, rate, discount] = $$<HTMLInputElement>(page.container, 'input');
    const totals = () => [text($(page.container, 'footer span')), text($(page.container, 'footer b'))];
    const discountLabel = () => text(discount.closest('label'));

    expect([hours.value, rate.value, discount.value]).toEqual(['12', '85', '10']);
    expect(hours.type).toBe('number');
    expect(discount.type).toBe('range');
    expect(discount.max).toBe('50');
    expect(discountLabel()).toBe('Discount 10%');
    expect(totals()).toEqual(['$1020.00', '$918.00']);

    await act.type(hours, '10');
    expect(totals()).toEqual(['$850.00', '$765.00']);

    await act.type(rate, '100');
    expect(totals()).toEqual(['$1000.00', '$900.00']);

    await act.type(discount, '50');
    expect(discountLabel()).toBe('Discount 50%');
    expect(totals()).toEqual(['$1000.00', '$500.00']);

    await act.type(discount, '0');
    expect(discountLabel()).toBe('Discount 0%');
    expect(totals()).toEqual(['$1000.00', '$1000.00']);
    expect([hours.value, rate.value, discount.value]).toEqual(['10', '100', '0']);
  });
});

describe('instructions/set-factory', () => {
  it('will suspend the profile and count followers in place', async () => {
    const page = await mount('instructions/set-factory');
    const pending = () => $$(page.container, '.pending').map(text);

    // React spec: Profile's own Component boundary (fallback null) catches first,
    // so the outer Suspense fallback "loading profile…" never shows.
    expect(page.container.querySelector('.card')).toBe(null);
    expect(pending()).toEqual(['counting followers…']);

    await act.fire(() => {}, 750);
    expect(text($(page.container, '.card h2'))).toBe('Welcome back, Ada');
    expect(text($(page.container, '.card small'))).toBe('Engineer');
    expect(pending()).toEqual(['counting followers…']);

    await act.fire(() => {}, 800);
    expect(pending()).toEqual(['1,204 followers']);
    expect(text($(page.container, '.card h2'))).toBe('Welcome back, Ada');
  });
});

