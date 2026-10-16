import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Calendar } from './calendar';

const at = (y: number, m: number, d: number) => new Date(y, m, d);

// Wednesday, 2024-01-17
const TODAY = new Date(2024, 0, 17, 12);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: TODAY });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('focus', () => {
  it('will default to today', () => {
    expect(Calendar.new().focus).toEqual(TODAY);
  });

  it('will start at selected date', () => {
    const selected = at(2023, 5, 3);

    expect(Calendar.new({ selected }).focus).toEqual(selected);
  });
});

describe('days', () => {
  it('will cover whole weeks of focused month', () => {
    const { days } = Calendar.new();

    expect(days).toHaveLength(35);
    expect(days[0].date).toEqual(at(2023, 11, 31));
    expect(days[34].date).toEqual(at(2024, 1, 3));
    expect(days[0].isCurrentMonth).toBe(false);
    expect(days[1].isCurrentMonth).toBe(true);
    expect(days[1].display).toBe(1);
  });

  it('will mark today and past', () => {
    const { days } = Calendar.new();
    const today = days.find((day) => day.isToday)!;

    expect(today.date).toEqual(at(2024, 0, 17));
    expect(today.isPast).toBe(false);
    expect(days[16].isPast).toBe(true);
  });

  it('will mark selected', () => {
    const { days } = Calendar.new({ selected: at(2024, 0, 5) });

    expect(days.filter((day) => day.selected)).toEqual([
      expect.objectContaining({ date: at(2024, 0, 5) })
    ]);
  });

  it('will select a day', async () => {
    const calendar = Calendar.new();
    const [, first] = calendar.days;

    (first.select as () => void)();

    expect(calendar.selected).toEqual(at(2024, 0, 1));
    await expect(calendar).toHaveUpdated('selected');
    expect(calendar.days[1].selected).toBe(true);
  });

  it('will disable days out of range', () => {
    const { days } = Calendar.new({
      min: at(2024, 0, 10),
      max: at(2024, 0, 20)
    });

    const enabled = days.filter((day) => day.select).map((day) => day.display);

    expect(enabled).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it('will treat true as today', () => {
    const { days } = Calendar.new({ min: true });

    expect(days.find((day) => day.select)?.date).toEqual(at(2024, 0, 17));
  });

  it('will recompute when focus moves', async () => {
    const calendar = Calendar.new();

    calendar.shift(1);
    await expect(calendar).toHaveUpdated('focus');

    expect(calendar.days[0].date).toEqual(at(2024, 0, 28));
  });
});

describe('month stepping', () => {
  it('will step back and forward', async () => {
    const calendar = Calendar.new();

    (calendar.backMonth as () => void)();
    await calendar.set();
    expect(calendar.focus).toEqual(new Date(2023, 11, 17, 12));

    (calendar.nextMonth as () => void)();
    await calendar.set();
    expect(calendar.focus).toEqual(TODAY);
  });

  it('will not step past bounds', () => {
    const calendar = Calendar.new({ min: true, max: true });

    expect(calendar.backMonth).toBe(false);
    expect(calendar.nextMonth).toBe(false);
  });

  it('will step within bounds', () => {
    const calendar = Calendar.new({
      min: at(2023, 11, 31),
      max: at(2024, 1, 1)
    });

    expect(calendar.backMonth).toBeInstanceOf(Function);
    expect(calendar.nextMonth).toBeInstanceOf(Function);
  });
});

describe('shift', () => {
  it('will shift by months and years', () => {
    const calendar = Calendar.new();

    expect(calendar.shift(2, 1)).toBe(true);
    expect(calendar.focus).toEqual(new Date(2025, 2, 17, 12));
  });

  it('will refuse to cross min', () => {
    const calendar = Calendar.new({ min: at(2024, 0, 1) });

    expect(calendar.shift(-1)).toBe(false);
    expect(calendar.focus).toEqual(TODAY);
  });

  it('will refuse to cross max', () => {
    const calendar = Calendar.new({ max: at(2024, 0, 31) });

    expect(calendar.shift(0, 1)).toBe(false);
    expect(calendar.focus).toEqual(TODAY);
  });
});

describe('months', () => {
  it('will list months of focused year', () => {
    const { months } = Calendar.new();

    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ value: 0, label: 'January', disabled: false });
    expect(months.every((month) => !month.disabled)).toBe(true);
  });

  it('will disable months out of range', () => {
    const { months } = Calendar.new({
      min: at(2024, 2, 15),
      max: at(2024, 4, 15)
    });

    const enabled = months.filter((m) => !m.disabled).map((m) => m.label);

    expect(enabled).toEqual(['March', 'April', 'May']);
  });
});

describe('years', () => {
  it('will default to twenty years either side', () => {
    const { years } = Calendar.new();

    expect(years).toHaveLength(41);
    expect(years[0]).toEqual({ value: 2004, label: '2004', disabled: false });
    expect(years[40].value).toBe(2044);
  });

  it('will span min to max', () => {
    const { years } = Calendar.new({
      min: at(2020, 5, 1),
      max: true
    });

    expect(years.map((y) => y.value)).toEqual([2020, 2021, 2022, 2023, 2024]);
  });

  it('will be empty when min exceeds max', () => {
    const { years } = Calendar.new({
      min: at(2030, 0, 1),
      max: at(2020, 0, 1)
    });

    expect(years).toEqual([]);
  });

  it('will ignore a false bound', () => {
    expect(Calendar.new({ min: false }).years).toHaveLength(41);
  });
});
