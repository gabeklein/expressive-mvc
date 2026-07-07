import type React from 'react';
import State from '@expressive/react';
import code from './Snippet';

type Snippet = ReturnType<typeof code>;

interface Side {
  label: string;
  code: Snippet;
}

interface CompareProps {
  left: Side;
  right: Side[];
}

const LN = { codeblock: { 'data-line-numbers': true } } as const;

class Control extends State {
  tab = 0;
  face = 0;

  select(i: number) {
    if (i === 0) {
      this.face = 0;
    } else {
      this.tab = i - 1;
      this.face = 1;
    }
  }
}

export default function Compare({ left, right }: CompareProps) {
  const { tab, face, select } = Control.use();

  const active = right[Math.min(tab, right.length - 1)];
  const Left = left.code;
  const Right = active.code;

  const libTabs =
    right.length > 1 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {right.map((s, i) => (
          <button
            key={s.label}
            onClick={() => select(i + 1)}
            className={`rounded-full font-mono text-xs py-1 px-2.5 transition-colors ${
              i === tab
                ? 'bg-fd-muted text-fd-foreground'
                : 'text-fd-muted-foreground hover:bg-fd-muted/60'
            }`}>
            {s.label}
          </button>
        ))}
      </div>
    ) : (
      <span className="text-sm font-semibold text-fd-muted-foreground">{active.label}</span>
    );

  return (
    <div>
      <div className="compare-static hidden lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <div>
          <Head>
            <span className="text-sm font-semibold text-fd-primary">{left.label}</span>
            <span className="text-[11px] uppercase tracking-widest text-fd-muted-foreground">
              Expressive
            </span>
          </Head>
          <Left {...LN} />
        </div>
        <div>
          <Head>{libTabs}</Head>
          <Right {...LN} />
        </div>
      </div>

      <div className="lg:hidden">
        <div className="flex flex-wrap gap-1 p-1 mb-3 w-fit rounded-2xl bg-fd-muted/50">
          <Segment active={face === 0} onClick={() => select(0)}>
            Expressive
          </Segment>
          {right.map((s, i) => (
            <Segment
              key={s.label}
              active={face === 1 && tab === i}
              onClick={() => select(i + 1)}>
              {s.label}
            </Segment>
          ))}
        </div>

        <div className="compare-static relative">
          <div
            className={`transition-opacity duration-300 motion-reduce:transition-none ${
              face ? 'absolute inset-x-0 top-0' : ''
            }`}
            style={{ opacity: face ? 0 : 1, pointerEvents: face ? 'none' : 'auto' }}>
            <Left {...LN} />
          </div>
          <div
            className={`transition-[clip-path] duration-300 motion-reduce:transition-none ${
              face ? '' : 'absolute inset-x-0 top-0'
            }`}
            style={{ clipPath: face ? 'inset(0 0 0 0)' : 'inset(0 0 0 100%)' }}>
            <Right {...LN} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-10 px-1 mb-2">
      {children}
    </div>
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full text-sm font-medium py-1 px-3 transition-colors ${
        active ? 'bg-fd-background text-fd-foreground shadow-sm' : 'text-fd-muted-foreground'
      }`}>
      {children}
    </button>
  );
}
