import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek
} from './date';

const at = (y: number, m: number, d: number, h = 0) => new Date(y, m, d, h);

describe('boundaries', () => {
  it('will find start of day', () => {
    expect(startOfDay(at(2024, 0, 15, 13))).toEqual(at(2024, 0, 15));
  });

  it('will find start and end of month', () => {
    expect(startOfMonth(at(2024, 1, 15, 13))).toEqual(at(2024, 1, 1));
    expect(endOfMonth(at(2024, 1, 15))).toEqual(new Date(at(2024, 2, 1).getTime() - 1));
  });

  it('will find start and end of week', () => {
    // 2024-01-17 is a Wednesday
    expect(startOfWeek(at(2024, 0, 17, 9))).toEqual(at(2024, 0, 14));
    expect(endOfWeek(at(2024, 0, 17))).toEqual(new Date(at(2024, 0, 21).getTime() - 1));
  });
});

describe('arithmetic', () => {
  it('will add days', () => {
    expect(addDays(at(2024, 0, 31), 1)).toEqual(at(2024, 1, 1));
  });

  it('will add months', () => {
    expect(addMonths(at(2024, 0, 15), 1)).toEqual(at(2024, 1, 15));
    expect(addMonths(at(2024, 0, 15), -1)).toEqual(at(2023, 11, 15));
  });

  it('will clamp to a shorter month', () => {
    expect(addMonths(at(2024, 0, 31), 1)).toEqual(at(2024, 1, 29));
    expect(addMonths(at(2023, 0, 31), 1)).toEqual(at(2023, 1, 28));
  });

  it('will add years', () => {
    expect(addYears(at(2024, 1, 29), 1)).toEqual(at(2025, 1, 28));
  });
});

describe('comparison', () => {
  it('will compare days', () => {
    expect(isSameDay(at(2024, 0, 1, 1), at(2024, 0, 1, 23))).toBe(true);
    expect(isSameDay(at(2024, 0, 1), at(2024, 0, 2))).toBe(false);
  });

  it('will compare months', () => {
    expect(isSameMonth(at(2024, 0, 1), at(2024, 0, 31))).toBe(true);
    expect(isSameMonth(at(2024, 0, 1), at(2025, 0, 1))).toBe(false);
    expect(isSameMonth(at(2024, 0, 1), at(2024, 1, 1))).toBe(false);
  });
});
