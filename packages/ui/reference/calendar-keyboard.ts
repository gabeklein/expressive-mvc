// keyboard left-right will increment the month
import { addMonths, addYears, startOfMonth } from 'date-fns';

import { Calendar } from './Calendar';

// keyboard up-down will increment the year
export function bindKeyboard(this: Calendar) {
  const keydown = (e: KeyboardEvent) => {
    const { focus } = this;
    if (!focus) return;

    let target: Date | undefined;

    switch (e.key) {
      case 'ArrowLeft':
        target = addMonths(focus, -1);
        break;
      case 'ArrowRight':
        target = addMonths(focus, 1);
        break;
      case 'ArrowUp':
        target = addYears(focus, -1);
        break;
      case 'ArrowDown':
        target = addYears(focus, 1);
        break;
      default:
        return;
    }

    e.preventDefault();

    let { min, max } = this;

    if (min === true) min = new Date();
    if (max === true) max = new Date();

    if (min && startOfMonth(target) < startOfMonth(min)) return;
    if (max && startOfMonth(target) > max) return;

    this.focus = target;
  };

  document.addEventListener('keydown', keydown);

  this.get(null, () => {
    document.removeEventListener('keydown', keydown);
  });

  return null;
}
