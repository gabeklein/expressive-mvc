import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, mount, RENDERER } from './harness';

/** Count static `State.get()` calls per class - each is one render of the scope calling it. Factory form (Consumer) keyed `Name(fn)`. */
async function countGets() {
  const { State } = (RENDERER == 'react'
    ? await import('@expressive/react')
    : await import('@expressive/mvc')) as any;
  const counts: Record<string, number> = {};
  const orig = State.get;
  vi.spyOn(State, 'get').mockImplementation(function (this: any, ...args: any[]) {
    const key = this.name + (typeof args[0] == 'function' ? '(fn)' : '');
    counts[key] = (counts[key] || 0) + 1;
    return orig.apply(this, args);
  });
  return {
    take() {
      const out = { ...counts };
      for (const k in counts) delete counts[k];
      return out;
    }
  };
}

afterEach(() => { vi.restoreAllMocks(); });

describe('composition/nested', () => {
  it('will share owned children with descendants and drop them on close', async () => {
    const page = await mount('composition/nested');
    const q = (s: string) => page.container.querySelector(s) as HTMLElement | null;
    const undo = () => page.getByRole('button', { name: /^Undo/ }) as HTMLButtonElement;
    const sheet = () => q('.editor textarea') as HTMLTextAreaElement;

    expect(undo().disabled).toBe(true);
    expect(undo().textContent).toBe('Undo ');
    expect(q('.toolbar small')!.textContent).toBe('0 words');
    expect(sheet().value).toBe('');

    await act.type(sheet(), 'hello');
    expect(sheet().value).toBe('hello');
    expect(q('.toolbar small')!.textContent).toBe('1 words');
    expect(undo().disabled).toBe(false);
    expect(undo().textContent).toBe('Undo 1');

    await act.type(sheet(), 'hello world');
    expect(q('.toolbar small')!.textContent).toBe('2 words');
    expect(undo().textContent).toBe('Undo 2');

    await act.click(undo());
    expect(sheet().value).toBe('hello');
    expect(q('.toolbar small')!.textContent).toBe('1 words');
    expect(undo().textContent).toBe('Undo 1');

    await act.click(undo());
    expect(sheet().value).toBe('');
    expect(q('.toolbar small')!.textContent).toBe('0 words');
    expect(undo().disabled).toBe(true);

    await act.type(sheet(), 'draft text here');
    expect(undo().textContent).toBe('Undo 1');
    expect(q('.toolbar small')!.textContent).toBe('3 words');

    await act.click(page.getByRole('button', { name: 'Close editor' }));
    expect(q('.editor')).toBeNull();
    expect(page.getByRole('button', { name: 'Open editor' })).toBeTruthy();

    await act.click(page.getByRole('button', { name: 'Open editor' }));
    expect(q('.editor')).not.toBeNull();
    expect(sheet().value).toBe('');
    expect(q('.toolbar small')!.textContent).toBe('0 words');
    expect(undo().disabled).toBe(true);
    expect(undo().textContent).toBe('Undo ');
    expect(page.getByRole('button', { name: 'Close editor' })).toBeTruthy();
  });
});

describe('composition/context', () => {
  it('will provide a map, update per-field subscribers only', async () => {
    const page = await mount('composition/context');
    const q = (s: string) => page.container.querySelector(s)!.textContent;

    expect(q('.greeting')).toBe('Ada is on bar');
    expect(q('.badge')).toBe('0 in cart');
    expect(q('.total')).toBe('Total $0');

    const gets = await countGets();

    await act.click(page.getByRole('button', { name: /Espresso/ }));
    expect(q('.badge')).toBe('1 in cart');
    expect(q('.total')).toBe('Total $3');
    expect(q('.greeting')).toBe('Ada is on bar');
    // Greeting (Shop) and Shelf (is: untracked) must not re-render; Badge re-renders once.
    const first = gets.take();
    expect(first.Shop ?? 0).toBe(0);
    expect(first.Cart).toBe(1);
    expect(first['Cart(fn)'] ?? 0).toBeLessThanOrEqual(1);

    await act.click(page.getByRole('button', { name: /Cortado/ }));
    await act.click(page.getByRole('button', { name: /Pour-over/ }));
    expect(q('.badge')).toBe('3 in cart');
    expect(q('.total')).toBe('Total $12');
    const next = gets.take();
    expect(next.Shop ?? 0).toBe(0);
    expect(next.Cart).toBe(2);

    const labels = [...page.container.querySelectorAll('.shelf button')].map(b => b.textContent);
    expect(labels).toEqual(['Espresso $3', 'Cortado $4', 'Pour-over $5']);
  });
});

describe('composition/concerns', () => {
  it('will filter, select and show detail across three classes', async () => {
    const page = await mount('composition/concerns');
    const hits = () => [...page.container.querySelectorAll('.results li')].map(li => li.textContent);
    const hit = (t: string) => [...page.container.querySelectorAll('.results li')].find(li => li.textContent == t) as HTMLElement;
    const detail = () => page.container.querySelector('.detail')!.textContent;
    const tag = (t: string) => page.getByRole('button', { name: t });
    const input = page.getByPlaceholderText('Search titles') as HTMLInputElement;

    expect(hits()).toEqual([
      'Analysis I',
      'Structure and Interpretation',
      'Concrete Mathematics',
      'The Art of Computer Programming'
    ]);
    expect(tag('all').className).toBe('tag on');
    expect(tag('math').className).toBe('tag');
    expect(detail()).toBe('no book selected');

    await act.click(tag('math'));
    expect(tag('math').className).toBe('tag on');
    expect(tag('all').className).toBe('tag');
    expect(hits()).toEqual(['Analysis I', 'Concrete Mathematics']);

    await act.click(hit('Concrete Mathematics'));
    expect(hit('Concrete Mathematics').className).toBe('hit on');
    expect(hit('Analysis I').className).toBe('hit');
    expect(detail()).toBe('Concrete Mathematics');

    await act.type(input, 'anal');
    expect(input.value).toBe('anal');
    expect(hits()).toEqual(['Analysis I']);
    expect(detail()).toBe('Concrete Mathematics');

    await act.type(input, 'zzz');
    expect(hits()).toEqual(['nothing matches']);
    expect(hit('nothing matches').className).toBe('empty');

    await act.click(tag('code'));
    await act.type(input, '');
    expect(hits()).toEqual(['Structure and Interpretation', 'The Art of Computer Programming']);

    await act.click(hit('The Art of Computer Programming'));
    expect(detail()).toBe('The Art of Computer Programming');
    expect(hit('The Art of Computer Programming').className).toBe('hit on');

    await act.click(tag('all'));
    expect(hits()).toHaveLength(4);
    expect(hit('The Art of Computer Programming').className).toBe('hit on');
    expect(hit('Concrete Mathematics').className).toBe('hit');
  });
});

describe('composition/extension', () => {
  it('will compose subclass render inside base chrome with independent state', async () => {
    const page = await mount('composition/extension');
    const panels = () => [...page.container.querySelectorAll('.panel')] as HTMLElement[];
    const head = (i: number) => panels()[i].querySelector('.head') as HTMLButtonElement;

    expect(panels()).toHaveLength(2);
    expect(head(0).querySelector('b')!.textContent).toBe('Tally');
    expect(head(1).querySelector('b')!.textContent).toBe('Notes');
    expect(head(0).getAttribute('aria-expanded')).toBe('true');
    expect(head(0).querySelector('span')!.textContent).toBe('–');

    const output = () => panels()[0].querySelector('output');
    const tally = (t: string) => [...panels()[0].querySelectorAll('.tally button')].find(b => b.textContent == t)!;
    expect(output()!.textContent).toBe('3');
    await act.click(tally('+'));
    await act.click(tally('+'));
    expect(output()!.textContent).toBe('5');
    await act.click(tally('−'));
    expect(output()!.textContent).toBe('4');

    const area = () => panels()[1].querySelector('textarea') as HTMLTextAreaElement | null;
    expect(area()!.placeholder).toBe('Type something, then collapse…');
    await act.type(area()!, 'remember me');
    expect(area()!.value).toBe('remember me');

    await act.click(head(1));
    expect(head(1).getAttribute('aria-expanded')).toBe('false');
    expect(head(1).querySelector('span')!.textContent).toBe('+');
    expect(area()).toBeNull();
    expect(panels()[1].querySelector('.body')).toBeNull();
    expect(head(0).getAttribute('aria-expanded')).toBe('true');
    expect(output()!.textContent).toBe('4');

    await act.click(tally('+'));
    expect(output()!.textContent).toBe('5');

    await act.click(head(1));
    expect(head(1).getAttribute('aria-expanded')).toBe('true');
    expect(area()!.value).toBe('remember me');

    await act.click(head(0));
    expect(output()).toBeNull();
    await act.click(head(0));
    expect(output()!.textContent).toBe('5');
  });
});

describe('composition/globals', () => {
  it('will reach globals without Provider and update only the reader', async () => {
    const page = await mount('composition/globals');
    const card = (i: number) => page.container.querySelectorAll('.card')[i] as HTMLElement;
    const b = (i: number) => card(i).querySelector('b')!.textContent;

    const initialWidth = window.innerWidth;
    expect(b(0)).toBe(`${initialWidth}px`);
    expect(card(0).querySelector('small')!.textContent).toBe(initialWidth < 600 ? 'compact layout' : 'wide layout');
    expect(b(1)).toBe('signed out');
    const initialDark = b(2);
    expect(['dark', 'light']).toContain(initialDark);
    expect(document.documentElement.dataset.theme).toBe(initialDark);

    const gets = await countGets();

    await act.fire(() => {
      (window as any).happyDOM.setViewport({ width: 480 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(window.innerWidth).toBe(480);
    expect(b(0)).toBe('480px');
    expect(card(0).querySelector('small')!.textContent).toBe('compact layout');
    const resized = gets.take();
    expect(resized.Viewport).toBe(1);
    expect(resized.Session ?? 0).toBe(0);
    expect(resized.Theme ?? 0).toBe(0);

    await act.fire(() => {
      (window as any).happyDOM.setViewport({ width: 900 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(b(0)).toBe('900px');
    expect(card(0).querySelector('small')!.textContent).toBe('wide layout');
    gets.take();

    await act.click(page.getByRole('button', { name: 'Log in' }));
    expect(b(1)).toBe('Ada');
    expect(page.queryByRole('button', { name: 'Log in' })).toBeNull();
    const login = gets.take();
    expect(login.Session).toBe(1);
    expect(login.Viewport ?? 0).toBe(0);
    expect(login.Theme ?? 0).toBe(0);

    await act.click(page.getByRole('button', { name: 'Log out' }));
    expect(b(1)).toBe('signed out');
    expect(page.getByRole('button', { name: 'Log in' })).toBeTruthy();

    const flipped = initialDark == 'dark' ? 'light' : 'dark';
    await act.click(page.getByRole('button', { name: 'Switch' }));
    expect(b(2)).toBe(flipped);
    expect(document.documentElement.dataset.theme).toBe(flipped);
    gets.take();

    await act.click(page.getByRole('button', { name: 'Switch' }));
    expect(b(2)).toBe(initialDark);
    expect(document.documentElement.dataset.theme).toBe(initialDark);
    const theme = gets.take();
    expect(theme.Theme).toBe(1);
    expect(theme.Viewport ?? 0).toBe(0);
    expect(theme.Session ?? 0).toBe(0);

    await act.fire(() => {
      (window as any).happyDOM.setViewport({ width: initialWidth });
      window.dispatchEvent(new Event('resize'));
    });
    expect(b(0)).toBe(`${initialWidth}px`);
  });
});
