const DAY = 86400000;

export function startOfDay(from: Date) {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfMonth(from: Date) {
  const date = startOfDay(from);
  date.setDate(1);
  return date;
}

export function endOfMonth(from: Date) {
  const date = startOfMonth(from);
  date.setMonth(date.getMonth() + 1);
  return new Date(date.getTime() - 1);
}

export function startOfWeek(from: Date) {
  const date = startOfDay(from);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export function endOfWeek(from: Date) {
  const date = startOfWeek(from);
  date.setDate(date.getDate() + 7);
  return new Date(date.getTime() - 1);
}

export function addDays(from: Date, count: number) {
  return new Date(from.getTime() + count * DAY);
}

/** Clamps to the last valid day when the target month is shorter. */
export function addMonths(from: Date, count: number) {
  const date = new Date(from);
  const day = date.getDate();

  date.setDate(1);
  date.setMonth(date.getMonth() + count);
  date.setDate(Math.min(day, daysInMonth(date)));

  return date;
}

export function addYears(from: Date, count: number) {
  return addMonths(from, count * 12);
}

export function setMonth(from: Date, month: number) {
  return addMonths(from, month - from.getMonth());
}

export function setYear(from: Date, year: number) {
  return addYears(from, year - from.getFullYear());
}

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function isSameMonth(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
  );
}

function daysInMonth(of: Date) {
  return new Date(of.getFullYear(), of.getMonth() + 1, 0).getDate();
}
