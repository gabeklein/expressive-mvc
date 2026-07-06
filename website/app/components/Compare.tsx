import type React from 'react';
import { useState } from 'react';
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

export default function Compare({ left, right }: CompareProps) {
  const [tab, setTab] = useState(0);
  const active = right[Math.min(tab, right.length - 1)];
  const Left = left.code;
  const Right = active.code;

  return (
    <div className="flex gap-4 snap-x snap-mandatory overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-2 lg:gap-5 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Column>
        <Head>
          <span className="text-sm font-semibold text-fd-primary">{left.label}</span>
          <span className="text-[11px] uppercase tracking-widest text-fd-muted-foreground">
            Expressive
          </span>
        </Head>
        <Left {...LN} />
      </Column>

      <Column>
        <Head>
          {right.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {right.map((s, i) => (
                <button
                  key={s.label}
                  onClick={() => setTab(i)}
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
            <span className="text-sm font-semibold text-fd-muted-foreground">
              {active.label}
            </span>
          )}
        </Head>
        <Right {...LN} />
      </Column>
    </div>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className="snap-center shrink-0 w-[86%] sm:w-[68%] lg:w-auto lg:shrink">
      {children}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 h-10 px-1 mb-2">
      {children}
    </div>
  );
}
