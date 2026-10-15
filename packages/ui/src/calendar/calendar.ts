import Model, { set } from '@expressive/mvc';

import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  setMonth,
  setYear,
  startOfDay,
  startOfMonth,
  startOfWeek
} from './date';

declare namespace Calendar {
  interface Day {
    date: Date;
    display: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    selected: boolean;
    /** `false` when out of range. */
    select: false | (() => void);
  }

  interface Option {
    value: number;
    label: string;
    disabled: boolean;
  }

  /** A boundary date, or `true` for "today". */
  type Bound = Date | boolean | undefined;
}

class Calendar extends Model {
  static months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  selected?: Date = undefined;
  focus = set(() => new Date(this.selected || new Date()));

  min: Calendar.Bound = undefined;
  max: Calendar.Bound = undefined;

  /**
   * `false` when the step would cross a bound - LFCP returned `undefined` here,
   * which a set-factory now reads as suspend.
   */
  backMonth = set((): false | (() => void) => {
    const prev = addMonths(this.focus, -1);
    const floor = bound(this.min);

    if (floor && startOfMonth(prev) < startOfMonth(floor)) return false;

    return () => (this.focus = prev);
  });

  nextMonth = set((): false | (() => void) => {
    const next = addMonths(this.focus, 1);
    const ceil = bound(this.max);

    if (ceil && startOfMonth(next) > ceil) return false;

    return () => (this.focus = next);
  });

  days = set((): Calendar.Day[] => {
    const { focus, selected } = this;
    const floor = bound(this.min);
    const ceil = bound(this.max);
    const end = endOfWeek(endOfMonth(focus));
    const now = new Date();
    const days: Calendar.Day[] = [];

    for (let d = startOfWeek(startOfMonth(focus)); d <= end; d = addDays(d, 1)) {
      const at = d;
      const disabled =
        (floor && at < startOfDay(floor)) || (ceil && at > ceil) || false;

      days.push({
        date: at,
        display: at.getDate(),
        isCurrentMonth: isSameMonth(at, focus),
        isToday: isSameDay(at, now),
        isPast: at < startOfDay(now),
        select: disabled ? false : () => this.select(at),
        selected: (selected && isSameDay(selected, at)) || false
      });
    }

    return days;
  });

  months = set((): Calendar.Option[] => {
    const floor = bound(this.min);
    const ceil = bound(this.max);
    const year = this.focus.getFullYear();

    return Calendar.months.map((label, value) => {
      const date = setMonth(setYear(new Date(), year), value);

      return {
        value,
        label,
        disabled:
          (floor && date < startOfMonth(floor)) || (ceil && date > ceil) || false
      };
    });
  });

  years = set((): Calendar.Option[] => {
    const start = bound(this.min) || addYears(new Date(), -20);
    const end = bound(this.max) || addYears(new Date(), 20);
    const from = start.getFullYear();
    const to = end.getFullYear();

    return Array.from({ length: Math.max(to + 1 - from, 0) }, (_, i) => ({
      value: from + i,
      label: String(from + i),
      disabled: false
    }));
  });

  select(date: Date) {
    this.selected = date;
  }

  /** Shift focus by whole months and/or years; refuses to cross min/max. */
  shift(months: number, years = 0) {
    const target = addYears(addMonths(this.focus, months), years);
    const floor = bound(this.min);
    const ceil = bound(this.max);

    if (floor && startOfMonth(target) < startOfMonth(floor)) return false;
    if (ceil && startOfMonth(target) > ceil) return false;

    this.focus = target;
    return true;
  }
}

function bound(from: Calendar.Bound) {
  return from === true ? new Date() : from || undefined;
}

export { Calendar };
