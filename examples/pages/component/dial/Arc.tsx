import { Component, get, ref } from '@expressive/react';
import type { KeyboardEvent, PointerEvent } from 'react';

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

/**
 * A draggable arc. `ref` holds the <svg> so a pointer handler can measure the
 * track and turn a screen position into an angle. No value lives here - it is
 * read from and written to the Scale above, which makes this control drop-in
 * beside any other view of the same field.
 */
export class Arc extends Component {
  scale = get(Scale);

  track = ref<SVGSVGElement>();

  /** Fraction along the sweep: 0 at the left end, 1 at the right. */
  get progress() {
    const { value, min, max } = this.scale;

    return (value - min) / (max - min);
  }

  /** Visual seam: what sits in the well of the arc. Digits by default. */
  Readout() {
    return <>{this.scale.value}</>;
  }

  grab(e: PointerEvent<SVGSVGElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    this.aim(e);
  }

  drag(e: PointerEvent<SVGSVGElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) this.aim(e);
  }

  nudge(e: KeyboardEvent<SVGSVGElement>) {
    const by = STEP[e.key];

    if (!by) return;

    e.preventDefault();
    this.scale.to(this.scale.value + by);
  }

  /** Screen point -> angle about the pivot -> value on the scale. */
  aim(e: PointerEvent<SVGSVGElement>) {
    const { min, max } = this.scale;
    const box = this.track.current!.getBoundingClientRect();
    const unit = box.width / W;
    const x = e.clientX - (box.left + CX * unit);
    const y = box.top + CY * unit - e.clientY;

    // Below the pivot the angle pins to whichever end is nearer, so a drag
    // that runs off the arc parks at min or max instead of jumping across.
    const turn = 1 - Math.atan2(Math.max(y, 0), x) / Math.PI;

    this.scale.to(min + turn * (max - min));
  }

  render() {
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
          <path className="filled" d={TRACK} strokeDasharray={`${progress * SWEEP} ${SWEEP}`} />
          <circle
            className="knob"
            cx={CX + R * Math.cos(angle)}
            cy={CY - R * Math.sin(angle)}
            r={11}
          />
        </svg>
        <div className="well">
          <this.Readout />
        </div>
      </div>
    );
  }
}
