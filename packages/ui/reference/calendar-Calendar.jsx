import { format } from 'date-fns';

import { Control } from './Control';
import { Header } from './Header';
import { bindKeyboard } from './keyboard';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class Calendar extends Control {
  render() {
    return (
      <Container>
        <Header />
        <Dates />
      </Container>
    );
  }
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
const Container = (props) => {
  $todayColor: $lightGrey;
  $lastMonthColor: $textGrey;
  $nextMonthColor: $textGrey;
  $pastColor: $textLight;
  $disabledColor: $lightGrey;
  $selectedBackground: $accent;
  $selectedColor: white;
  userSelect: none;

  return <div {...props} />;
};

Calendar.on(bindKeyboard);

const Dates = () => {
  const { dates } = Calendar.get();

  display: grid;
  gridTemplateColumns: 'repeat(7, 1fr)';
  gap: 14;

  return (
    <div>
      {Array.from({ length: 7 }).map((_, day) => (
        <WeekDay key={day} day={day} />
      ))}
      {dates.map((day) => (
        <SelectDate key={day.date.getTime()} {...day} />
      ))}
    </div>
  );
};

/**
 * @param {Object} props
 * @param {number} props.day - The name of the day.
 */
const WeekDay = ({ day }) => {
  size: 30;
  color: $textGrey;
  cursor: 'default';
  display: flex;
  justifyContent: center;
  alignItems: center;

  return <div>{WEEKDAYS[day]}</div>;
};

/**
 * @param {Object} props
 * @param {() => void} [props.select] - Function to call when selecting the date.
 * @param {boolean} [props.selected] - Whether the date is currently selected.
 * @param {React.ReactNode} [props.display] - The content to display for the date.
 * @param {boolean} [props.isCurrentMonth] - Whether the date is in the current month.
 * @param {boolean} [props.isPast] - Whether the date is in the past.
 * @param {boolean} [props.isToday] - Whether the date is today.
 * @param {Date} props.date - The date object.
 */
const SelectDate = ({
  select,
  selected,
  display,
  isCurrentMonth,
  isPast,
  isToday,
  date
}) => {
  size: 30;
  cursor: pointer;
  display: flex;
  justifyContent: center;
  alignItems: center;
  borderRadius: '50%';
  color: $textLight;

  if (selected) {
    background: $selectedBackground;
    color: $selectedColor;
    borderRadius: '50%';
  }

  if (isToday) {
    background: $todayColor;
    borderRadius: '50%';
  }

  if (!select) {
    color: $disabledColor;
  }

  if (!isCurrentMonth && isPast) {
    color: $lastMonthColor;
  }

  if (isPast) {
    color: $pastColor;
  }

  if (!isCurrentMonth) {
    color: $nextMonthColor;
  }

  return (
    <div
      onClick={select}
      role="gridcell"
      aria-label={format(date, 'MM/dd/yy')}
      aria-selected={selected || undefined}
      aria-disabled={!select || undefined}>
      {display}
    </div>
  );
};
