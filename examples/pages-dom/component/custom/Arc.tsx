/** @jsxImportSource @expressive/dom */
import { Component, get, ref } from '@expressive/mvc';

import { Scale } from './Scale';

const W = 240;
const H = 148;
const CX = 120;
const CY = 124;
const R = 100;

const TRACK = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const SWEEP = Math.PI * R;

const STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1
};

export class Arc extends Component {
  scale = get(Scale);

  track = ref<SVGSVGElement>();

  get progress() {
    const { value, min, max } = this.scale;

    return (value - min) / (max - min);
  }

  grab(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    this.aim(e);
  }

  drag(e: PointerEvent) {
    if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) this.aim(e);
  }

  nudge(e: KeyboardEvent) {
    const by = STEP[e.key];

    if (!by) return;

    e.preventDefault();
    this.scale.to(this.scale.value + by);
  }

  aim(e: PointerEvent) {
    const { min, max } = this.scale;
    const box = this.track.current!.getBoundingClientRect();
    const unit = box.width / W;
    const x = e.clientX - (box.left + CX * unit);
    const y = box.top + CY * unit - e.clientY;

    // Clamping y at the pivot pins an off-arc drag to whichever end is nearer,
    // instead of letting it jump across.
    const turn = 1 - Math.atan2(Math.max(y, 0), x) / Math.PI;

    this.scale.to(min + turn * (max - min));
  }

  render(props = {} as { children?: Component.Node }) {
    const { progress } = this;
    const { value, min, max } = this.scale;
    const angle = Math.PI * (1 - progress);

    return (
      <div class="arc">
        <svg
          ref={this.track}
          viewBox={`0 0 ${W} ${H}`}
          role="slider"
          tabIndex={0}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          onPointerDown={this.grab}
          onPointerMove={this.drag}
          onKeyDown={this.nudge}>
          <path class="groove" d={TRACK} />
          <path class="filled" d={TRACK} stroke-dasharray={`${progress * SWEEP} ${SWEEP}`} />
          <circle
            class="knob"
            cx={CX + R * Math.cos(angle)}
            cy={CY - R * Math.sin(angle)}
            r={11}
          />
        </svg>
        <div class="well">{props.children ?? value}</div>
      </div>
    );
  }
}
