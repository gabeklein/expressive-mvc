import { Component, get, ref } from '@expressive/mvc';

import { Scale } from './Scale';

type Pointer = { currentTarget: SVGSVGElement; pointerId: number; clientX: number; clientY: number };
type Key = { key: string; preventDefault(): void };

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

  grab(e: Pointer) {
    e.currentTarget.setPointerCapture(e.pointerId);
    this.aim(e);
  }

  drag(e: Pointer) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) this.aim(e);
  }

  nudge(e: Key) {
    const by = STEP[e.key];

    if (!by) return;

    e.preventDefault();
    this.scale.to(this.scale.value + by);
  }

  aim(e: Pointer) {
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
      <div className="arc">
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
          <path className="groove" d={TRACK} />
          <path className="filled" d={TRACK} style={{ strokeDasharray: `${progress * SWEEP} ${SWEEP}` }} />
          <circle
            className="knob"
            cx={CX + R * Math.cos(angle)}
            cy={CY - R * Math.sin(angle)}
            r={11}
          />
        </svg>
        <div className="well">{props.children ?? value}</div>
      </div>
    );
  }
}
