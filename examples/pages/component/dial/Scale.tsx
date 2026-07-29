import { Component } from '@expressive/react';

export class Scale extends Component {
  value = 1;
  min = 1;
  max = 100;

  // Clamp and round on the way in, so no control has to.
  to(value: number) {
    if (Number.isNaN(value)) return;

    this.value = Math.min(this.max, Math.max(this.min, Math.round(value)));
  }
}
