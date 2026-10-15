import { Model, get, set } from '@expressive/react';
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
} from 'date-fns';

interface SelectDate {
  date: Date;
  display: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  selected: boolean;
  select: undefined | (() => void);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export class Control extends Model {
  selected: Date | string | undefined = undefined;
  focus = set(() => new Date(this.selected || new Date()));
  min?: Date | boolean = undefined;
  max?: Date | boolean = undefined;

  backMonth = get(this, ({ focus, min }) => {
    const prev = addMonths(focus, -1);

    if (min === true) min = new Date();
    if (min && startOfMonth(prev) < startOfMonth(min)) return;

    return () => (this.focus = prev);
  });

  nextMonth = get(this, ({ focus, max }) => {
    const next = addMonths(focus, 1);

    if (max === true) max = new Date();
    if (max && startOfMonth(next) > max) return;

    return () => (this.focus = next);
  });

  setDate(date: Date) {
    this.selected = date;
  }

  readonly dates = get(this, ({ focus, min, max, selected }) => {
    if (min === true) min = new Date();
    if (max === true) max = new Date();

    const startDate = startOfWeek(startOfMonth(focus));
    const endDate = endOfWeek(endOfMonth(focus));
    const dates: SelectDate[] = [];

    for (let d = startDate, now = new Date(); d <= endDate; d = addDays(d, 1)) {
      const isPast = d < startOfDay(now);
      const disabled =
        (min && d < startOfDay(min)) || (max && d > max) || false;

      dates.push({
        date: d,
        display: d.getDate(),
        isCurrentMonth: isSameMonth(d, focus),
        isToday: isSameDay(d, now),
        isPast,
        select: disabled ? undefined : () => this.setDate(d),
        selected: (selected && isSameDay(selected, d)) || false
      });
    }

    return dates;
  });

  readonly months = get(this, ({ focus, min, max }) => {
    const currentYear = focus.getFullYear();

    return MONTHS.map((name, index) => {
      const date = setMonth(setYear(new Date(), currentYear), index);

      const disabled =
        (min && date < startOfMonth(min === true ? new Date() : min)) ||
        (max && date > (max === true ? new Date() : max)) ||
        false;

      return {
        value: index,
        label: name,
        disabled
      };
    });
  });

  readonly years = get(this, ({ min, max }) => {
    const start = min == true ? new Date() : min || addYears(new Date(), -20);
    const end = max == true ? new Date() : max || addYears(new Date(), 20);

    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    return Array.from({ length: endYear + 1 - startYear }, (_, i) => ({
      value: startYear + i,
      label: startYear + i
    }));
  });
}
