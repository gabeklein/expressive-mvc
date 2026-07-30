import './App.css';

import { Component, ref } from '@expressive/react';
import type { PointerEvent } from 'react';

class Draggable extends Component {
  box = ref<HTMLDivElement>();

  x = 72;
  y = 64;
  dragging = false;

  offset = { x: 0, y: 0 };

  // Capturing the pointer keeps the drag tracking when it outruns the box.
  grab(e: PointerEvent) {
    const rect = this.box.current!.getBoundingClientRect();

    this.offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.dragging = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  move(e: PointerEvent) {
    if (!this.dragging) return;

    const box = this.box.current!;
    const surface = box.parentElement!.getBoundingClientRect();

    this.x = clamp(e.clientX - surface.left - this.offset.x, 0, surface.width - box.offsetWidth);
    this.y = clamp(e.clientY - surface.top - this.offset.y, 0, surface.height - box.offsetHeight);
  }

  drop() {
    this.dragging = false;
  }

  render() {
    const { x, y, dragging } = this;

    return (
      <div className="container drag">
        <div className="surface">
          <div
            ref={this.box}
            className={dragging ? 'box dragging' : 'box'}
            style={{ transform: `translate(${x}px, ${y}px)` }}
            onPointerDown={this.grab}
            onPointerMove={this.move}
            onPointerUp={this.drop}>
            {Math.round(x)}, {Math.round(y)}
          </div>
        </div>
      </div>
    );
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default () => <Draggable />;
