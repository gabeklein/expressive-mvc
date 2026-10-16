import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { Calendar } from './calendar';
import { keyboard } from './keyboard';

const TODAY = new Date(2024, 0, 17, 12);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: TODAY });
});

afterEach(() => {
  vi.useRealTimers();
});

class Picker extends Calendar {
  constructor(...args: any[]) {
    super(...args, keyboard);
  }
}

function press(key: string) {
  const event = new KeyboardEvent('keydown', { key, cancelable: true });

  document.dispatchEvent(event);

  return event;
}

it('will step months with left and right', () => {
  const picker = Picker.new();

  expect(press('ArrowRight').defaultPrevented).toBe(true);
  expect(picker.focus).toEqual(new Date(2024, 1, 17, 12));

  press('ArrowLeft');
  press('ArrowLeft');
  expect(picker.focus).toEqual(new Date(2023, 11, 17, 12));

  picker.set(null);
});

it('will step years with up and down', () => {
  const picker = Picker.new();

  press('ArrowDown');
  expect(picker.focus).toEqual(new Date(2025, 0, 17, 12));

  press('ArrowUp');
  press('ArrowUp');
  expect(picker.focus).toEqual(new Date(2023, 0, 17, 12));

  picker.set(null);
});

it('will ignore other keys', () => {
  const picker = Picker.new();

  expect(press('Enter').defaultPrevented).toBe(false);
  expect(picker.focus).toEqual(TODAY);

  picker.set(null);
});

it('will unbind when destroyed', () => {
  const picker = Picker.new();

  picker.set(null);
  press('ArrowRight');

  expect(picker.focus).toEqual(TODAY);
});
