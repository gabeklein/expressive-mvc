import { describe, expect, it, onTestFinished } from 'vitest';
import { act, mount, norm } from './harness';

const txt = (el: Element | null) => norm(el?.textContent ?? null);

/**
 * happy-dom forwards any click inside a <label> to its labeled control, even
 * when the target is itself interactive content (spec: no activation). The def
 * page nests stepper buttons in a label, so every "+3" would also click "−3".
 */
function labelActivationPerSpec() {
  const proto = HTMLLabelElement.prototype;
  const original = proto.dispatchEvent;
  const interactive = 'button, input, select, textarea, a[href], details, embed, iframe';

  proto.dispatchEvent = function (this: HTMLLabelElement, event: Event) {
    const target = event.target as Element | null;
    if (event.type != 'click' || !target || target === this || !target.closest?.(interactive))
      return original.call(this, event);
    Object.defineProperty(this, 'control', { get: () => null, configurable: true });
    try { return original.call(this, event); }
    finally { delete (this as any).control; }
  };

  return () => { proto.dispatchEvent = original; };
}

describe('instructions/def', () => {
  it('will clamp volume and slugify handle', async () => {
    onTestFinished(labelActivationPerSpec());
    const page = await mount('instructions/def');
    const out = page.container.querySelector('output')!;
    const minus = page.getByText('−3');
    const plus = page.getByText('+3');

    expect(txt(out)).toBe('5');
    await act.click(minus);
    expect(txt(out)).toBe('2');
    await act.click(minus);
    expect(txt(out)).toBe('0');
    await act.click(plus);
    expect(txt(out)).toBe('3');
    await act.click(plus);
    await act.click(plus);
    await act.click(plus);
    expect(txt(out)).toBe('10');

    const input = page.getByPlaceholderText('Type A Name') as HTMLInputElement;
    expect(input.value).toBe('');
    await act.type(input, 'Hello World');
    expect(input.value).toBe('hello-world');
    await act.type(input, 'hello-world!!Foo');
    expect(input.value).toBe('hello-world-foo');
  });
});

describe('instructions/get', () => {
  it('will find the form upstream and lock its fields', async () => {
    const page = await mount('instructions/get');
    const fields = () => [...page.container.querySelectorAll('label.field')];
    const input = (i: number) => fields()[i].querySelector('input') as HTMLInputElement;

    expect(fields().map(f => txt(f.querySelector('span')))).toEqual([
      'Namein a form',
      'Emailin a form',
      'Nicknameno form above'
    ]);
    expect(page.container.querySelector('fieldset.group legend')!.textContent).toBe('Contact');
    expect(fields()[1].closest('fieldset')).not.toBeNull();
    expect(fields().map((_, i) => input(i).placeholder)).toEqual(['Your name', 'Your email', 'Your nickname']);
    expect(fields().map((_, i) => input(i).disabled)).toEqual([false, false, false]);

    await act.type(input(0), 'Ada');
    expect(input(0).value).toBe('Ada');
    await act.type(input(2), 'ace');
    expect(input(2).value).toBe('ace');

    const toggle = page.getByText('Lock form');
    await act.click(toggle);
    expect(txt(toggle)).toBe('Unlock form');
    expect(fields().map((_, i) => input(i).disabled)).toEqual([true, true, false]);
    expect(fields().map((_, i) => input(i).placeholder)).toEqual(['locked', 'locked', 'Your nickname']);
    expect(input(0).value).toBe('Ada');

    await act.click(toggle);
    expect(txt(toggle)).toBe('Lock form');
    expect(fields().map((_, i) => input(i).disabled)).toEqual([false, false, false]);
    expect(fields().map((_, i) => input(i).placeholder)).toEqual(['Your name', 'Your email', 'Your nickname']);
  });
});

describe('instructions/get-downstream', () => {
  it('will collect candidates below and vet write-ins', async () => {
    const page = await mount('instructions/get-downstream');
    const tally = () => txt(page.container.querySelector('.tally'));
    const items = () => [...page.container.querySelectorAll('li.candidate')];
    const names = () => items().map(li => txt(li.querySelector('span')));
    const item = (name: string) => items().find(li => txt(li.querySelector('span')) === name)!;
    const chosen = () => items().filter(li => li.classList.contains('chosen')).map(li => txt(li.querySelector('span')));

    expect(tally()).toBe('3 on the roster · chose —');
    expect(names()).toEqual(['Ada', 'Alan', 'Grace']);
    expect(chosen()).toEqual([]);

    await act.click(item('Alan'));
    expect(tally()).toBe('3 on the roster · chose Alan');
    expect(chosen()).toEqual(['Alan']);
    expect(item('Alan').className).toBe('candidate chosen');

    const input = page.getByPlaceholderText('Add a write-in') as HTMLInputElement;
    await act.type(input, '  Linus ');
    expect(input.value).toBe('  Linus ');
    await act.click(page.getByText('Add'));
    expect(input.value).toBe('');
    expect(names()).toEqual(['Ada', 'Alan', 'Grace', 'Linus']);
    expect(txt(item('Linus').querySelector('em'))).toBe('write-in');
    expect(item('Ada').querySelector('em')).toBeNull();
    expect(tally()).toBe('3 on the roster · chose Alan');

    await act.submit(page.container.querySelector('form.add')!);
    expect(names()).toEqual(['Ada', 'Alan', 'Grace', 'Linus', 'Anonymous']);
    expect(tally()).toBe('3 on the roster · chose Alan');

    await act.click(item('Linus'));
    expect(chosen()).toEqual(['Linus']);
    expect(tally()).toBe('3 on the roster · chose Linus');

    await act.click(item('Ada').querySelector('button')!);
    expect(names()).toEqual(['Alan', 'Grace', 'Linus', 'Anonymous']);
    expect(tally()).toBe('2 on the roster · chose Linus');
    expect(chosen()).toEqual(['Linus']);

    await act.click(item('Linus').querySelector('button')!);
    expect(names()).toEqual(['Alan', 'Grace', 'Anonymous']);
    expect(tally()).toBe('2 on the roster · chose —');
    expect(chosen()).toEqual([]);

    await act.click(item('Grace'));
    await act.click(item('Grace').querySelector('button')!);
    expect(names()).toEqual(['Alan', 'Anonymous']);
    expect(tally()).toBe('1 on the roster · chose —');
  });
});

describe('instructions/has', () => {
  it('will add, toggle, clear and remove pooled todos', async () => {
    const page = await mount('instructions/has');
    const rows = () => [...page.container.querySelectorAll('.card ul > li')];
    const texts = () => rows().map(li => txt(li.querySelector('span')));
    const footer = () => txt(page.container.querySelector('.card footer small'));
    const input = page.getByPlaceholderText('Add a task…') as HTMLInputElement;
    const add = page.getByLabelText('add');

    expect(texts()).toEqual(['Learn Expressive']);
    expect(footer()).toBe('1 of 1 left');

    await act.click(add);
    expect(texts()).toEqual(['Learn Expressive']);

    await act.type(input, 'Buy milk');
    await act.click(add);
    expect(input.value).toBe('');
    expect(texts()).toEqual(['Learn Expressive', 'Buy milk']);
    expect(footer()).toBe('2 of 2 left');

    await act.type(input, 'Walk dog');
    await act.submit(page.container.querySelector('.card > form')!);
    expect(texts()).toEqual(['Learn Expressive', 'Buy milk', 'Walk dog']);
    expect(footer()).toBe('3 of 3 left');

    await act.click(rows()[0].querySelector('[aria-label=toggle]')!);
    expect(rows()[0].className).toBe('done');
    expect(footer()).toBe('2 of 3 left');

    await act.click(rows()[2].querySelector('span')!);
    expect(rows()[2].className).toBe('done');
    expect(footer()).toBe('1 of 3 left');

    await act.click(rows()[2].querySelector('span')!);
    expect(rows()[2].className).toBe('');
    expect(footer()).toBe('2 of 3 left');

    await act.click(page.getByText('Clear done'));
    expect(texts()).toEqual(['Buy milk', 'Walk dog']);
    expect(footer()).toBe('2 of 2 left');

    await act.click(rows()[0].querySelector('[aria-label=remove]')!);
    expect(texts()).toEqual(['Walk dog']);
    expect(footer()).toBe('1 of 1 left');

    await act.click(rows()[0].querySelector('[aria-label=remove]')!);
    expect(texts()).toEqual([]);
    expect(footer()).toBe('0 of 0 left');
  });
});

describe('instructions/has-list', () => {
  it('will push and undo list entries', async () => {
    const page = await mount('instructions/has-list');
    const rows = () => [...page.container.querySelectorAll('ol.entries > li')].map(li =>
      [txt(li.querySelector('.idx')), txt(li.querySelector('.entry'))]
    );
    const footer = () => txt(page.container.querySelector('footer small'));
    const input = page.getByPlaceholderText('Record an action…') as HTMLInputElement;
    const push = page.getByText('Push');
    const undo = page.getByText('Undo') as HTMLButtonElement;

    expect(rows()).toEqual([['0', 'open document']]);
    expect(footer()).toBe('1 entries · latest: open document');
    expect(undo.disabled).toBe(false);

    await act.type(input, '   ');
    await act.click(push);
    expect(rows()).toHaveLength(1);

    await act.type(input, ' type heading ');
    await act.click(push);
    expect(input.value).toBe('');
    expect(rows()).toEqual([['0', 'open document'], ['1', 'type heading']]);
    expect(footer()).toBe('2 entries · latest: type heading');

    await act.type(input, 'bold text');
    await act.submit(page.container.querySelector('form')!);
    expect(rows()).toEqual([['0', 'open document'], ['1', 'type heading'], ['2', 'bold text']]);
    expect(footer()).toBe('3 entries · latest: bold text');

    await act.click(undo);
    expect(rows()).toEqual([['0', 'open document'], ['1', 'type heading']]);
    expect(footer()).toBe('2 entries · latest: type heading');

    await act.click(undo);
    await act.click(undo);
    expect(rows()).toEqual([]);
    expect(footer()).toBe('0 entries · latest: —');
    expect(undo.disabled).toBe(true);

    await act.type(input, 'reopen');
    await act.click(push);
    expect(rows()).toEqual([['0', 'reopen']]);
    expect(undo.disabled).toBe(false);
  });
});

describe('instructions/map', () => {
  it('will select people and cycle status', async () => {
    const page = await mount('instructions/map');
    const people = () => [...page.container.querySelectorAll('ul.people > li')];
    const person = (name: string) => people().find(li => txt(li.querySelector('.name')) === name)!;
    const selected = () => people().filter(li => li.classList.contains('selected')).map(li => txt(li.querySelector('.name')));
    const dot = (name: string) => person(name).querySelector('.dot')!.className;
    const detail = () => page.container.querySelector('aside.detail')!;

    expect(people().map(li => txt(li.querySelector('.name')))).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
    expect(people().map(li => li.className)).toEqual(['person selected', 'person', 'person', 'person']);
    expect(people().map(li => li.querySelector('.dot')!.className)).toEqual(Array(4).fill('dot online'));
    expect(txt(detail().querySelector('h2'))).toBe('Alice');
    expect(txt(detail().querySelector('.status'))).toBe('online');
    expect(detail().querySelector('.dot')!.className).toBe('dot lg online');

    await act.click(person('Bob'));
    expect(selected()).toEqual(['Bob']);
    expect(txt(detail().querySelector('h2'))).toBe('Bob');

    await act.click(person('Carol').querySelector('.dot')!);
    expect(dot('Carol')).toBe('dot away');
    expect(selected()).toEqual(['Bob']);
    expect(txt(detail().querySelector('h2'))).toBe('Bob');
    expect(txt(detail().querySelector('.status'))).toBe('online');

    await act.click(page.getByText('Cycle status'));
    expect(dot('Bob')).toBe('dot away');
    expect(txt(detail().querySelector('.status'))).toBe('away');
    expect(detail().querySelector('.dot')!.className).toBe('dot lg away');

    await act.click(page.getByText('Cycle status'));
    expect(dot('Bob')).toBe('dot busy');
    expect(txt(detail().querySelector('.status'))).toBe('busy');

    await act.click(page.getByText('Cycle status'));
    expect(dot('Bob')).toBe('dot online');
    expect(detail().querySelector('.dot')!.className).toBe('dot lg online');

    await act.click(person('Carol'));
    expect(selected()).toEqual(['Carol']);
    expect(txt(detail().querySelector('h2'))).toBe('Carol');
    expect(txt(detail().querySelector('.status'))).toBe('away');
    expect(detail().querySelector('.dot')!.className).toBe('dot lg away');

    await act.click(person('Carol').querySelector('.dot')!);
    expect(dot('Carol')).toBe('dot busy');
    expect(txt(detail().querySelector('.status'))).toBe('busy');
    expect(dot('Alice')).toBe('dot online');
  });
});
