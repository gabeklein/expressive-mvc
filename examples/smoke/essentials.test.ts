import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, mount } from './harness';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const reply = (body: unknown) => ({ json: async () => body }) as Response;
const person = (first: string, last: string) => reply({ results: [{ name: { first, last } }] });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('essentials/counter', () => {
  it('will increment, decrement and reset', async () => {
    const page = await mount('essentials/counter');
    const pre = page.container.querySelector('pre')!;
    const [dec, inc] = page.getAllByRole('button');

    expect(page.getByRole('heading', { level: 1 }).textContent).toBe('Counter Example');
    expect(dec.textContent).toBe('−');
    expect(inc.textContent).toBe('+');
    expect(dec.className).toBe('button');
    expect(inc.className).toBe('button');
    expect(pre.textContent).toBe('1');

    await act.click(inc);
    await act.click(inc);
    expect(pre.textContent).toBe('3');

    await act.click(dec);
    expect(pre.textContent).toBe('2');

    await act.click(pre);
    expect(pre.textContent).toBe('1');

    await act.click(dec);
    await act.click(dec);
    expect(pre.textContent).toBe('-1');

    await act.click(pre);
    expect(pre.textContent).toBe('1');
    expect(page.container.querySelector('pre')).toBe(pre);
  });
});

describe('essentials/async', () => {
  const tick = (seconds: number) => act.fire(() => vi.advanceTimersByTime(seconds * 1000));

  async function start() {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const page = await mount('essentials/async');
    const seconds = () => page.container.querySelector('.seconds')!.textContent;
    return { page, seconds };
  }

  it('will count down and replace an agent', async () => {
    const fetch = vi.fn(async () => reply({ results: [{ name: { last: 'Smith' } }] }));
    vi.stubGlobal('fetch', fetch);

    const { page, seconds } = await start();

    expect(page.getAllByRole('heading', { level: 1 })[0].textContent).toBe('Async Example');
    expect(page.container.querySelector('h1.box')!.textContent).toBe('📦');
    expect(page.container.querySelector('b')!.textContent).toBe('Agent Bond');
    expect(seconds()).toBe('30');

    await tick(1);
    expect(seconds()).toBe('29');

    await tick(3);
    expect(seconds()).toBe('26');

    await act.click(page.getByRole('button', { name: 'Tap another agent' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://randomuser.me/api?nat=gb&results=1');
    expect(page.container.querySelector('b')!.textContent).toBe('Agent Smith');
    expect(seconds()).toBe('26');
  });

  it('will explode the cat when time runs out', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const { page } = await start();

    await tick(29);
    expect(page.text()).toContain('If you can\'t do it in 1 seconds');

    await tick(1);
    expect(page.container.querySelector('.emoji')!.textContent).toBe('🙀💥');
    expect(page.getByRole('heading', { level: 2 }).textContent).toBe('Unfortunately, the cat exploded.');
    expect(page.queryByRole('button')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('will spare the cat when time runs out', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const { page } = await start();

    await tick(30);
    expect(page.container.querySelector('.emoji')!.textContent).toBe('😸👍');
    expect(page.getByRole('heading', { level: 2 }).textContent).toBe('Oh, the cat did not explode.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('will clear its timer on unmount', async () => {
    const { page } = await start();
    expect(page.text()).toContain('Agent Bond');
    expect(vi.getTimerCount()).toBe(1);

    await cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('essentials/computed', () => {
  it('will recompute tip and total from bill and percent', async () => {
    const page = await mount('essentials/computed');
    const [bill, percent] = Array.from(page.container.querySelectorAll('input'));
    const result = () => page.container.querySelector('.result')!.textContent;
    const bold = () => Array.from(page.container.querySelectorAll('.result b'), b => b.textContent);

    expect(page.getByRole('heading', { level: 1 }).textContent).toBe('Computed');
    expect(bill.type).toBe('number');
    expect(bill.value).toBe('50');
    expect(percent.type).toBe('range');
    expect(percent.min).toBe('0');
    expect(percent.max).toBe('30');
    expect(percent.value).toBe('18');
    expect(page.text()).toContain('Tip: 18%');
    expect(result()).toBe('Tip $9.00 · Total $59.00');
    expect(bold()).toEqual(['$9.00', '$59.00']);

    await act.type(bill, '120');
    expect(bill.value).toBe('120');
    expect(result()).toBe('Tip $21.60 · Total $141.60');

    await act.type(percent, '25');
    expect(percent.value).toBe('25');
    expect(page.text()).toContain('Tip: 25%');
    expect(result()).toBe('Tip $30.00 · Total $150.00');

    await act.type(percent, '0');
    expect(page.text()).toContain('Tip: 0%');
    expect(result()).toBe('Tip $0.00 · Total $120.00');

    await act.type(bill, '33.5');
    expect(result()).toBe('Tip $0.00 · Total $33.50');

    await act.type(percent, '10');
    expect(result()).toBe('Tip $3.35 · Total $36.85');
    expect(page.container.querySelectorAll('input')[0]).toBe(bill);
  });
});

describe('essentials/fetch', () => {
  it('will wait, greet and reset', async () => {
    let pending = deferred<Response>();
    const fetch = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', fetch);

    const page = await mount('essentials/fetch');
    expect(page.getByRole('heading', { level: 1 }).textContent).toBe('Fetch Example');

    const send = page.getByRole('button', { name: 'Say hello to server' });
    expect(send.className).toBe('fetch-action');

    await act.click(send);
    expect(fetch).toHaveBeenCalledWith('https://randomuser.me/api?nat=us&results=1');
    expect(page.queryByRole('button')).toBeNull();
    expect(page.container.querySelector('.fetch-status')!.textContent).toBe('Sent. Waiting on response...');

    await act.fire(() => pending.resolve(person('Ada', 'Lovelace')));
    expect(page.container.querySelector('.fetch-status')).toBeNull();
    expect(page.container.querySelector('.fetch-result span')!.textContent).toBe('Server said: Hello Ada Lovelace');

    await act.click(page.getByRole('button', { name: 'Reset' }));
    expect(page.container.querySelector('.fetch-result')).toBeNull();

    pending = deferred<Response>();
    await act.click(page.getByRole('button', { name: 'Say hello to server' }));
    expect(fetch).toHaveBeenCalledTimes(2);
    await act.fire(() => pending.resolve(person('Alan', 'Turing')));
    expect(page.text()).toBe('Fetch ExampleServer said: Hello Alan TuringReset');
  });

  it('will show an error and reset', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));

    const page = await mount('essentials/fetch');
    await act.click(page.getByRole('button', { name: 'Say hello to server' }));
    expect(page.text()).toContain('Sent. Waiting on response...');

    await act.fire(() => pending.reject(new Error('offline')));
    expect(page.container.querySelector('.fetch-result span')!.textContent).toBe('Error: offline');
    expect(page.container.querySelector('.fetch-status')).toBeNull();

    await act.click(page.getByRole('button', { name: 'Reset' }));
    expect(page.getByRole('button', { name: 'Say hello to server' })).toBeTruthy();
    expect(page.text()).toBe('Fetch ExampleSay hello to server');
  });
});
