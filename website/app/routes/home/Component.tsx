import State, { Component as StateComponent, get, ref } from '@expressive/react';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function ComponentSection() {
  return (
    <section id="component" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24 grid gap-12 lg:grid-cols-[2fr_3fr] lg:items-center">
        <div className="lg:-translate-y-6">
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Component is renderable State.
          </h2>
          <p className="text-fd-muted-foreground text-lg mb-4">
            Reach for <code>Component</code> when making self-contained{" "}
            (<a href="#molecules" className="underline-offset-2 underline">or extensible</a>) display logic.
            Fields drive lazy getters and <code>render()</code>{' '} directly -
            destructure <code>this</code> as you would use hook.
          </p>
          <p className="text-fd-muted-foreground text-lg">
            A Component is its own Provider too,
            accessible to children with no prop drilling.
          </p>
        </div>

        <div className="min-w-0">
          <TipDemo />
        </div>
      </div>
    </section>
  );
}

type TipField = 'bill' | 'tipPercent';
type TipStep = `${TipField}-input` | `${TipField}-field` |
  'tip' | 'total' | 'destructure' | 'jsx';

class TipTrace extends State {
  root = ref<HTMLDivElement>();
  private run = { current: 0 };

  protected new() {
    return () => {
      this.run.current++;
    };
  }

  async play(field: TipField, debounce = 180) {
    const run = ++this.run.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (debounce) await new Promise(resolve => window.setTimeout(resolve, debounce));
    if (run !== this.run.current) return;
    this.root.current?.querySelectorAll('.trace-held').forEach(element => {
      element.classList.remove('trace-held');
    });

    const timeline: readonly (readonly [number, TipStep?])[] = [
      ...(field === 'bill' ? [
        [0, 'bill-input'],
        [80, 'bill-field'],
      ] as const : []),
      [50, 'tip'],
      [50, 'total'],
      [50, 'destructure'],
      [50, 'jsx'],
      [70],
    ];

    for (const [delay, step] of timeline) {
      if (delay) await new Promise(resolve => window.setTimeout(resolve, delay));
      if (run !== this.run.current) return;
      if (step) this.pulse(step);
    }
  }

  hold(...steps: TipStep[]) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const step of steps) {
      this.root.current?.querySelectorAll(`.tip-trace-${step}`).forEach(element => {
        element.classList.add('trace-held');
      });
    }
  }

  private pulse(step: TipStep) {
    for (const element of this.root.current?.querySelectorAll<HTMLElement>(`.tip-trace-${step}`) ?? []) {
      element.classList.remove('trace-pulse');
      void element.offsetWidth;
      element.classList.add('trace-pulse');
      element.addEventListener('animationend', () => {
        element.classList.remove('trace-pulse');
      }, { once: true });
    }
  }
}

class TipDemo extends StateComponent {
  bill = 50;
  tipPercent = 18;
  trace = new TipTrace();

  render() {
    const { bill, tipPercent, trace: { root } } = this;

    return (
      <div ref={root}>
        <div className="code-nowrap">
          <TipExample bill={bill} tipPercent={tipPercent} />
        </div>
        <TipCalculator />
        <Playground to="/examples/essentials/reactivity" />
      </div>
    );
  }
}

class TipCalculator extends StateComponent {
  demo = get(TipDemo);

  bill = 50;
  tipPercent = 18;

  get tip() {
    return (this.bill * this.tipPercent) / 100;
  }

  get total() {
    return this.bill + this.tip;
  }

  update(field: TipField, value: number) {
    this[field] = value;
    this.demo[field] = value;
    if (field === 'tipPercent') {
      this.demo.trace.hold('tipPercent-input', 'tipPercent-field');
    }
    this.demo.trace.play(field, field === 'tipPercent' ? 2500 : undefined);
  }

  settle(field: TipField) {
    this.demo.trace.play(field, 0);
  }

  render() {
    const { bill, tipPercent, tip, total, settle, update } = this;

    return (
      <div className="mt-4 rounded-lg border border-fd-border py-3 px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 font-mono text-sm">
            $
            <input
              type="number"
              inputMode="decimal"
              min={0}
              className="w-16 rounded border border-fd-border bg-transparent py-1 px-2 text-base sm:text-sm"
              value={bill}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={() => settle('bill')}
              onChange={(e) => update('bill', +e.target.value)}
            />
          </label>
          <label className="flex flex-1 items-center gap-2 font-mono text-sm min-w-32">
            {tipPercent}%
            <input
              type="range"
              className="flex-1 min-w-20"
              min={0}
              max={30}
              value={tipPercent}
              onChange={(e) => update('tipPercent', +e.target.value)}
              onKeyUp={() => settle('tipPercent')}
              onPointerUp={() => settle('tipPercent')}
            />
          </label>
          <span className="font-mono text-sm whitespace-nowrap basis-full text-center sm:basis-auto sm:text-left sm:ml-auto">
            tip {tip.toFixed(2)} · total {total.toFixed(2)}
          </span>
        </div>
      </div>
    );
  }
}

type TipExampleProps = { bill: number; tipPercent: number };

function TipExample({ bill, tipPercent }: TipExampleProps) {
  const Example = code /*tsx*/`
    import React from 'react';
    import { Component } from '@expressive/react';

    class TipCalculator extends Component {
      bill = ${bill};
      tipPercent = ${tipPercent};

      get tip() {
        return (this.bill * this.tipPercent) / 100;
      }

      get total() {
        return this.bill + this.tip;
      }

      render() {
        const { bill, tipPercent, tip, total } = this;

        return (
          <div>
            <input type="number" value={bill}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => (this.bill = +e.target.value)}
            />
            <input type="range" min={0} max={30} value={tipPercent}
              onChange={(e) => (this.tipPercent = +e.target.value)}
            />
            <p>
              Tip {tip.toFixed(2)} · Total {total.toFixed(2)}
            </p>
          </div>
        );
      }
    }
  `;

  return Example({
    highlight: {
      prefix: 'tip-trace',
      targets: {
        'bill-input': /this\.bill = \+e\.target\.value/,
        'tipPercent-input': /this\.tipPercent = \+e\.target\.value/,
        'bill-field': /bill = \d+/,
        'tipPercent-field': /tipPercent = \d+/,
        tip: /return \(this\.bill \* this\.tipPercent\) \/ 100/,
        total: /return this\.bill \+ this\.tip/,
        destructure: /bill, tipPercent, tip, total/,
        jsx: /Tip \{tip\.toFixed\(2\)\} · Total \{total\.toFixed\(2\)\}/,
      },
    },
  });
}
