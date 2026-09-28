import { fireEvent } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { act, errors, mount, norm, RENDERER, settle } from './harness';

const $ = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const $$ = (root: ParentNode, sel: string) => Array.from(root.querySelectorAll(sel));
const texts = (root: ParentNode, sel: string) => $$(root, sel).map((e) => norm(e.textContent));

/** Remove and return console.error / uncaught entries matching `pattern`. */
function drain(pattern: RegExp) {
  const out: unknown[][] = [];
  for (let i = errors.length - 1; i >= 0; i--)
    if (errors[i].some((a) => pattern.test(a instanceof Error ? a.message : String(a))))
      out.unshift(...errors.splice(i, 1));
  return out;
}

describe('component/props', () => {
  it('will reapply parent props and keep own seeded state', async () => {
    const page = await mount('component/props');
    const [cpu, disk] = $$(page.container, '.gauge');
    const out = (g: Element) => norm($(g, 'output').textContent);
    const fill = (g: Element) => $(g, '.fill').style.width;
    const btn = (g: Element, t: string) => $$(g, 'footer button').find((b) => b.textContent === t)!;
    const preset = (name: string) => page.getByText(name, { selector: 'button' });

    expect(texts(page.container, '.gauge header span')).toEqual(['CPU', 'Disk']);
    expect(out(cpu)).toBe('8%');
    expect(fill(cpu)).toBe('8%');
    expect(out(disk)).toBe('128 GB');
    expect(fill(disk)).toBe('25%');
    expect(preset('idle').className).toBe('button primary');
    expect(preset('busy').className).toBe('button');

    await act.click(preset('busy'));
    expect(out(cpu)).toBe('62%');
    expect(fill(cpu)).toBe('62%');
    expect(preset('busy').className).toBe('button primary');
    expect(preset('idle').className).toBe('button');

    await act.click(btn(cpu, '+'));
    expect(out(cpu)).toBe('72%');
    expect(fill(cpu)).toBe('72%');

    await act.click(btn(disk, '+'));
    await act.click(btn(disk, '+'));
    expect(out(disk)).toBe('192 GB');
    expect(fill(disk)).toBe('38%');

    // same preset: no parent render, bump holds
    await act.click(preset('busy'));
    expect(out(cpu)).toBe('72%');

    await act.click(preset('peak'));
    expect(out(cpu)).toBe('97%');
    await act.click(btn(cpu, '+'));
    expect(out(cpu)).toBe('100%');
    expect(out(disk)).toBe('192 GB');

    await act.click(preset('idle'));
    expect(out(cpu)).toBe('8%');
    await act.click(btn(cpu, '−'));
    expect(out(cpu)).toBe('0%');
    expect(out(disk)).toBe('192 GB');
  });
});

describe('component/subcomponents', () => {
  it('will select through overridden Item and Summary seams', async () => {
    const page = await mount('component/subcomponents');
    const [fruit, color] = $$(page.container, '.picker');

    expect(fruit.className).toBe('pane picker fruit');
    expect(color.className).toBe('pane picker palette');
    expect(norm($(fruit, 'h2').textContent)).toBe('Choose Fruit');
    expect(norm($(color, 'h2').textContent)).toBe('Choose Color');
    expect(texts(fruit, 'li')).toEqual(['🍎 Apple', '🍏 Banana', '🍏 Cherry']);
    expect($$(fruit, 'li').map((l) => l.className)).toEqual(['active', '', '']);
    expect(norm($(fruit, ':scope > small').textContent)).toBe('Selected: Apple');

    const swatches = $$(color, '.swatch') as HTMLElement[];
    expect(swatches.map((s) => s.style.background)).toEqual(['#ff6f61', '#4dabf7', '#51cf66']);
    expect(norm($(color, ':scope > small').textContent)).toBe('Coral #ff6f61');

    await act.click($$(fruit, 'li')[1]);
    expect(texts(fruit, 'li')).toEqual(['🍏 Apple', '🍎 Banana', '🍏 Cherry']);
    expect($$(fruit, 'li').map((l) => l.className)).toEqual(['', 'active', '']);
    expect(norm($(fruit, ':scope > small').textContent)).toBe('Selected: Banana');
    expect(norm($(color, ':scope > small').textContent)).toBe('Coral #ff6f61');

    await act.click(swatches[2]);
    expect($$(color, 'li').map((l) => l.className)).toEqual(['', '', 'active']);
    expect(norm($(color, ':scope > small code').textContent)).toBe('#51cf66');
    expect(norm($(color, ':scope > small').textContent)).toBe('Mint #51cf66');

    await act.click($$(fruit, 'li')[2]);
    expect(norm($(fruit, ':scope > small').textContent)).toBe('Selected: Cherry');
    expect($$(color, 'li').map((l) => l.className)).toEqual(['', '', 'active']);
  });
});

describe('component/injection', () => {
  it('will swap instances in place and keep their state', async () => {
    const page = await mount('component/injection');
    const slot = $(page.container, '.slot');
    const tab = (name: string) => page.getByText(name, { selector: 'button' });
    const area = () => $<HTMLTextAreaElement>(slot, 'textarea');
    const head = () => norm($(slot, 'header').textContent);

    expect(tab('Draft').className).toBe('button primary');
    expect(tab('Review').className).toBe('button');
    expect(head()).toBe('Draft0 words');
    expect(area().placeholder).toBe('Write the draft…');

    await act.type(area(), 'hello brave world');
    expect(head()).toBe('Draft3 words');

    await act.click(tab('Review'));
    expect(tab('Review').className).toBe('button primary');
    expect(tab('Draft').className).toBe('button');
    expect($$(slot, '.panel')).toHaveLength(1);
    expect(head()).toBe('Review0 words');
    expect(area().value).toBe('');
    expect(area().placeholder).toBe('Write the review…');

    await act.type(area(), 'lgtm');
    expect(head()).toBe('Review1 words');

    await act.click(tab('Draft'));
    expect(head()).toBe('Draft3 words');
    expect(area().value).toBe('hello brave world');

    await act.click(tab('Close'));
    expect(slot.children).toHaveLength(0);
    expect(norm(slot.textContent)).toBe('');
    expect(tab('Draft').className).toBe('button');
    expect(tab('Review').className).toBe('button');

    await act.click(tab('Review'));
    expect(head()).toBe('Review1 words');
    expect(area().value).toBe('lgtm');

    await act.type(area(), '   ');
    expect(head()).toBe('Review0 words');
  });
});

describe('component/headless', () => {
  it('will tick two scopes at their own rates', async () => {
    const page = await mount('component/headless');
    const readouts = () => texts(page.container, '.readout strong');

    expect($$(page.container, '.pair > *').map((e) => e.className)).toEqual(['readout', 'readout']);
    expect(texts(page.container, '.readout small')).toEqual(['every 100ms', 'every 1000ms']);
    expect(readouts()).toEqual(['0.0s', '0.0s']);

    await settle(450);
    const [fast, slow] = readouts();
    expect(parseFloat(fast)).toBeGreaterThanOrEqual(0.3);
    expect(slow).toBe('0.0s');

    await settle(700);
    const [fast2, slow2] = readouts();
    expect(parseFloat(fast2)).toBeGreaterThanOrEqual(1.0);
    expect(parseFloat(slow2)).toBeGreaterThanOrEqual(1.0);
    expect(parseFloat(slow2)).toBeLessThan(1.1);
  });

  it('will stop ticking on unmount', async () => {
    await mount('component/headless');
    const spy = { cleared: 0 };
    const orig = globalThis.clearInterval;
    globalThis.clearInterval = ((id: any) => { spy.cleared++; return orig(id); }) as any;
    try {
      const { cleanup } = await import('./harness');
      await cleanup();
      expect(spy.cleared).toBe(2);
    } finally {
      globalThis.clearInterval = orig;
    }
  });
});

describe('component/lifecycle', () => {
  const TRACE_MOUNT = ['new() · constructed', 'ref() · element attached', 'mount() · committed'];
  const TRACE_UNMOUNT = ['ref() · element detached', 'mount() cleanup · unmounted', 'new() cleanup · destroyed'];

  it('will fire each seam and unwind on unmount', async () => {
    window.innerWidth = 800;
    const page = await mount('component/lifecycle');
    const trace = () => texts(page.container, '.trace li');
    const toggle = () => page.getByText(/^(Unmount|Mount)$/, { selector: 'button' });
    const probe = () => $(page.container, '.probe');

    expect(trace()).toEqual(TRACE_MOUNT);
    expect(norm($(probe(), 'strong').textContent)).toBe('800px');
    expect(norm($(probe(), 'small').textContent)).toBe('alive 0s');
    expect(toggle().textContent).toBe('Unmount');

    await act.fire(() => {
      window.innerWidth = 640;
      window.dispatchEvent(new Event('resize'));
    });
    expect(norm($(probe(), 'strong').textContent)).toBe('640px');

    await settle(1050);
    expect(norm($(probe(), 'small').textContent)).toBe('alive 1s');

    await act.click(toggle());
    expect(probe()).toBeNull();
    expect(toggle().textContent).toBe('Mount');
    expect(trace()).toEqual([...TRACE_MOUNT, ...TRACE_UNMOUNT]);

    // listener removed: resize after unmount logs nothing and throws nothing
    await act.fire(() => window.dispatchEvent(new Event('resize')));
    expect(trace()).toHaveLength(6);

    await act.click(page.getByText('Clear'));
    expect(trace()).toEqual([]);
    expect($(page.container, '.trace').children).toHaveLength(0);

    await act.click(toggle());
    expect(trace()).toEqual(TRACE_MOUNT);
    expect(norm($(probe(), 'strong').textContent)).toBe('640px');
    expect(norm($(probe(), 'small').textContent)).toBe('alive 0s');

    await act.click(toggle());
    expect(trace()).toEqual([...TRACE_MOUNT, ...TRACE_UNMOUNT]);
  });
});

describe('component/suspense', () => {
  it('will show each fallback until its value resolves', async () => {
    const page = await mount('component/suspense');
    const [own, deferred] = $$(page.container, '.card');
    const body = (card: Element) => norm(card.textContent);

    expect(body(own)).toBe('Its own boundaryGreeting someone…');
    expect(body(deferred)).toBe('Deferred to an ancestorThe panel is waiting…');
    expect($(own, 'p.result')).toBeNull();

    await settle(1000);
    expect(body(own)).toBe('Its own boundaryHello, Ada.');
    expect($(own, 'p.result')).not.toBeNull();
    expect(body(deferred)).toBe('Deferred to an ancestorThe panel is waiting…');

    await settle(500);
    expect(body(deferred)).toBe('Deferred to an ancestorGoodbye, Grace.');
    expect(norm($(deferred, 'p.result').textContent)).toBe('Goodbye, Grace.');

    await act.click(page.getByText('Ask again'));
    expect(body(own)).toBe('Its own boundaryGreeting someone…');
    expect(body(deferred)).toBe('Deferred to an ancestorThe panel is waiting…');

    await settle(1000);
    expect(body(own)).toBe('Its own boundaryHello, Ada.');
    expect(body(deferred)).toBe('Deferred to an ancestorThe panel is waiting…');

    await settle(500);
    expect(body(deferred)).toBe('Deferred to an ancestorGoodbye, Grace.');
  });
});

describe('component/boundary', () => {
  const RECOVERED = 'The widget failed to render.';
  const ESCALATED = 'The widget gave up.';
  // React dev logs each error an error boundary catches; dom reports nothing.
  const logged = (n: number) => (RENDERER == 'react' ? n : 0);

  const setup = async () => {
    const page = await mount('component/boundary');
    const cards = () => $$(page.container, '.card');
    const card = (i: number) => norm(cards()[i].textContent);
    const outer = () => $(page.container, '.container > .error');
    return { page, cards, card, outer };
  };

  it('will recover in place', async () => {
    const { page, cards, card, outer } = await setup();

    expect(cards()).toHaveLength(2);
    expect(card(0)).toBe('Handled in placeBreak it');
    expect(card(1)).toBe('EscalatedBreak it');

    await act.click($(cards()[0], 'button'));
    expect(drain(new RegExp(RECOVERED))).toHaveLength(logged(1));
    expect(card(0)).toBe(`Handled in placeCaught right here: ${RECOVERED}Retry`);
    expect($(cards()[0], '.error')).not.toBeNull();
    expect($(cards()[0], '.error button').className).toBe('button');
    expect(card(1)).toBe('EscalatedBreak it');
    expect(outer()).toBeNull();

    await act.click(page.getByText('Retry'));
    expect(card(0)).toBe('Handled in placeBreak it');
    expect($(cards()[0], '.error')).toBeNull();

    await act.click($(cards()[0], 'button'));
    expect(drain(new RegExp(RECOVERED))).toHaveLength(logged(1));
    expect(card(0)).toBe(`Handled in placeCaught right here: ${RECOVERED}Retry`);
    await act.click(page.getByText('Retry'));
    expect(card(0)).toBe('Handled in placeBreak it');
  });

  it('will escalate to the boundary and start over', async () => {
    const { page, cards, card, outer } = await setup();

    await act.click($(cards()[1], 'button'));
    expect(drain(new RegExp(ESCALATED))).toHaveLength(logged(2));
    expect(cards()).toHaveLength(0);
    expect(norm(outer()?.textContent ?? null)).toBe(`Reached the boundary: ${ESCALATED}Start over`);
    expect($(outer(), 'button').className).toBe('button primary');
    expect(norm($(page.container, '.container > small').textContent)).toMatch(/^The first card keeps its error/);

    await act.click(page.getByText('Start over'));
    expect(outer()).toBeNull();
    expect(card(0)).toBe('Handled in placeBreak it');
    expect(card(1)).toBe('EscalatedBreak it');

    await act.click($(cards()[1], 'button'));
    expect(drain(new RegExp(ESCALATED))).toHaveLength(logged(2));
    expect(norm(outer()?.textContent ?? null)).toBe(`Reached the boundary: ${ESCALATED}Start over`);
    await act.click(page.getByText('Start over'));
    expect(card(1)).toBe('EscalatedBreak it');
  });

  it('will rebuild an inner fallback under an outer one', async () => {
    const { page, cards, card } = await setup();

    await act.click($(cards()[0], 'button'));
    expect(drain(new RegExp(RECOVERED))).toHaveLength(logged(1));
    await act.click($(cards()[1], 'button'));
    expect(drain(new RegExp(ESCALATED))).toHaveLength(logged(2));
    expect(cards()).toHaveLength(0);

    await act.click(page.getByText('Start over'));
    expect(cards()).toHaveLength(2);
    expect(card(0)).toBe('Handled in placeBreak it');
  });
});

describe('component/custom', () => {
  const stubBox = (svg: Element) =>
    (svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 240, height: 148, right: 240, bottom: 148, x: 0, y: 0, toJSON() {} }) as DOMRect);

  it('will render the arc as an accessible SVG slider', async () => {
    const page = await mount('component/custom');
    const svg = $(page.container, 'svg[role=slider]');
    const dash = () => {
      const path = $$(svg, 'path')[1] as SVGElement;
      return path.getAttribute('stroke-dasharray') ?? path.style.strokeDasharray.replace(/px|,/g, '');
    };
    const sweep = Math.PI * 100;

    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 240 148');
    expect(svg.getAttribute('aria-valuenow')).toBe('14');
    expect(dash()).toBe(`${(13 / 99) * sweep} ${sweep}`);
    expect(svg.getAttribute('tabindex')).toBe('0');
    expect(svg.tabIndex).toBe(0);
    expect(svg.getAttributeNames().sort()).toEqual(['aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'role', 'tabindex', 'viewBox']);
    expect($$(svg, 'path')[1].getAttributeNames().sort()).toEqual(['class', 'd', 'style']);

    await act.key(svg, 'ArrowRight');
    expect(dash()).toBe(`${(14 / 99) * sweep} ${sweep}`);
  });

  it('will keep arc, slider and input in step', async () => {
    const page = await mount('component/custom');
    const svg = $(page.container, 'svg[role=slider]');
    const range = $<HTMLInputElement>(page.container, 'input[type=range]');
    const digits = $<HTMLInputElement>(page.container, 'input[type=number]');
    const well = () => norm($(page.container, '.well').textContent);
    const footer = () => norm($(page.container, 'footer small').textContent);
    const state = () => ({
      now: svg.getAttribute('aria-valuenow'),
      range: range.value,
      digits: digits.value,
      well: well(),
      footer: footer()
    });
    const knob = () => [$(svg, 'circle').getAttribute('cx'), $(svg, 'circle').getAttribute('cy')];

    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect($(svg, 'path').namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe('0 0 240 148');
    expect(svg.getAttribute('aria-valuemin')).toBe('1');
    expect(svg.getAttribute('aria-valuemax')).toBe('100');
    expect($$(svg, 'path').map((p) => p.getAttribute('class'))).toEqual(['groove', 'filled']);
    expect($(svg, 'circle').getAttribute('class')).toBe('knob');
    expect($(svg, 'circle').getAttribute('r')).toBe('11');
    expect(range.min).toBe('1');
    expect(range.max).toBe('100');
    expect(state()).toEqual({ now: '14', range: '14', digits: '14', well: 'XIV', footer: 'Manuscript, Volume XIV' });

    await act.key(svg, 'ArrowRight');
    expect(state()).toEqual({ now: '15', range: '15', digits: '15', well: 'XV', footer: 'Manuscript, Volume XV' });
    await act.key(svg, 'ArrowUp');
    await act.key(svg, 'ArrowDown');
    await act.key(svg, 'ArrowLeft');
    expect(state().now).toBe('14');
    await act.key(svg, 'a');
    expect(state().now).toBe('14');

    const down = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    await act.fire(() => svg.dispatchEvent(down));
    expect(down.defaultPrevented).toBe(true);
    const other = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act.fire(() => svg.dispatchEvent(other));
    expect(other.defaultPrevented).toBe(false);
    expect(state().now).toBe('15');

    await act.type(digits, '49');
    expect(state()).toEqual({ now: '49', range: '49', digits: '49', well: 'XLIX', footer: 'Manuscript, Volume XLIX' });

    await act.type(range, '88');
    expect(state()).toEqual({ now: '88', range: '88', digits: '88', well: 'LXXXVIII', footer: 'Manuscript, Volume LXXXVIII' });

    await act.type(digits, '150');
    expect(state().now).toBe('100');
    expect(state().well).toBe('C');
    expect(digits.value).toBe('100');

    await act.type(digits, '0');
    expect(state().now).toBe('1');
    expect(digits.value).toBe('1');

    await act.type(digits, '12.6');
    expect(state().now).toBe('13');
    expect(digits.value).toBe('13');

    // pointer: pivot at (120,124), radius 100
    stubBox(svg);
    await act.fire(() => fireEvent.pointerDown(svg, { pointerId: 1, clientX: 120, clientY: 24 }));
    expect(state().now).toBe('51');
    expect(knob().map((n) => Math.round(Number(n)))).toEqual([122, 24]);

    await act.fire(() => fireEvent.pointerMove(svg, { pointerId: 1, clientX: 220, clientY: 124 }));
    expect(state().now).toBe('100');
    expect(state().well).toBe('C');

    // below the pivot pins to the nearer end
    await act.fire(() => fireEvent.pointerMove(svg, { pointerId: 1, clientX: 10, clientY: 200 }));
    expect(state().now).toBe('1');
    expect(state().well).toBe('I');

    // a pointer without capture does not drag
    await act.fire(() => fireEvent.pointerMove(svg, { pointerId: 2, clientX: 220, clientY: 124 }));
    expect(state().now).toBe('1');
  });

  it('will not submit the form', async () => {
    const page = await mount('component/custom');
    const form = $<HTMLFormElement>(page.container, 'form.volume');
    const ev = new Event('submit', { bubbles: true, cancelable: true });
    await act.fire(() => form.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(true);
  });
});
