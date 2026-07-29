import { Component } from '@expressive/react';

/**
 * Base for a form that owns a bounded number. Controls placed inside find
 * the form by context and drive `value` through `to` - the form is the only
 * source, so no control needs to know the others exist.
 */
export class Scale extends Component {
  value = 1;
  min = 1;
  max = 100;

  /** Clamp and round on the way in, so no control has to. */
  to(value: number) {
    if (Number.isNaN(value)) return;

    this.value = Math.min(this.max, Math.max(this.min, Math.round(value)));
  }
}
