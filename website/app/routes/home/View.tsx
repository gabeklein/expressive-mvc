import { Component } from '@expressive/react';
import Playground from '@/components/Playground';
import code from '@/components/Snippet';

export function View() {
  return (
    <section className="panel">
      <div className="mx-auto max-w-(--content-width) py-16 md:py-24 px-6 grid gap-12 lg:grid-cols-[2fr_3fr] lg:items-center">
        <div>
          <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Component is state that renders itself.
          </h2>
          <p className="text-fd-muted-foreground text-lg mb-4">
            Reach for <code className={mono}>Component</code> when making self-contained (or{' '}
            <a href="#molecules" className="text-fd-primary underline-offset-2 hover:underline">extensible</a>) display logic.
            Fields drive <code className={mono}>render()</code>{' '} directly -
            destructure <code className={mono}>this</code>, assign on events.
          </p>
          <p className="text-fd-muted-foreground text-lg"> A{' '}
            <code className={mono}>Component</code> is also its own Provider.
            Children access from context, nothing to wrap, no prop drilling.
          </p>
        </div>

        <div className="min-w-0">
          <div className="code-nowrap">
            <TipExample />
          </div>
          <LiveTip />
          <Playground to="/examples/essentials/reactivity" />
        </div>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

class TipCalculator extends Component {
  bill = 50;
  tipPercent = 18;

  get tip() {
    return (this.bill * this.tipPercent) / 100;
  }

  get total() {
    return this.bill + this.tip;
  }

  render() {
    const { bill, tipPercent, tip, total } = this;

    return (
      <div className="mt-4 rounded-lg border border-fd-border py-3 px-4">
        <div className="text-xs tracking-widest text-fd-muted-foreground mb-3">
          LIVE - Code above is whole component, ready to use.
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-2 font-mono text-sm">
            $
            <input
              type="number"
              className="w-16 rounded border border-fd-border bg-transparent py-1 px-2"
              value={bill}
              onChange={(e) => (this.bill = +e.target.value)}
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
              onChange={(e) => (this.tipPercent = +e.target.value)}
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

function LiveTip() {
  return <TipCalculator />;
}

const TipExample = code /*tsx*/`
  import React from 'react';
  import { Component } from '@expressive/react';

  class TipCalculator extends Component {
    bill = 50;
    tipPercent = 18;

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
            onChange={(e) => (this.bill = +e.target.value)} />
          <input type="range" min={0} max={30} value={tipPercent}
            onChange={(e) => (this.tipPercent = +e.target.value)} />
          <p>
            Tip {tip.toFixed(2)} · Total {total.toFixed(2)}
          </p>
        </div>
      );
    }
  }
`;
