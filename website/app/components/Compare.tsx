import type React from 'react';
import { useRef, useState } from 'react';
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
  const [face, setFace] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const panelB = useRef<HTMLDivElement>(null);

  const active = right[Math.min(tab, right.length - 1)];
  const Left = left.code;
  const Right = active.code;

  const go = (i: number) => {
    setFace(i);
    const el = strip.current;
    const b = panelB.current;
    if (el && b) el.scrollTo({ left: i === 0 ? 0 : b.offsetLeft, behavior: 'smooth' });
  };

  const onScroll = () => {
    const el = strip.current;
    const b = panelB.current;
    if (el && b) setFace(el.scrollLeft + el.clientWidth / 2 >= b.offsetLeft ? 1 : 0);
  };

  const leftHead = (
    <Head>
      <span className="text-sm font-semibold text-fd-primary">{left.label}</span>
      <span className="text-[11px] uppercase tracking-widest text-fd-muted-foreground">
        Expressive
      </span>
    </Head>
  );

  const libTabs =
    right.length > 1 ? (
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
      <span className="text-sm font-semibold text-fd-muted-foreground">{active.label}</span>
    );

  return (
    <div>
      <div className="compare-static hidden lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <div>{leftHead}{<Left {...LN} />}</div>
        <div>
          <Head>{libTabs}</Head>
          {<Right {...LN} />}
        </div>
      </div>

      <div className="lg:hidden">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex gap-1 p-1 rounded-full bg-fd-muted/50">
            <Segment active={face === 0} onClick={() => go(0)}>
              Expressive
            </Segment>
            <Segment active={face === 1} onClick={() => go(1)}>
              The rest
            </Segment>
          </div>
          {face === 1 && libTabs}
        </div>

        <div
          ref={strip}
          onScroll={onScroll}
          className="compare-strip relative flex gap-4 overflow-x-auto snap-x [scroll-snap-type:x_proximity] -mx-6 px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="snap-start shrink-0 min-w-full w-max">{<Left {...LN} />}</div>
          <div ref={panelB} className="snap-start shrink-0 min-w-full w-max">
            {<Right {...LN} />}
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
      className={`rounded-full text-sm font-medium py-1.5 px-4 transition-colors ${
        active ? 'bg-fd-background text-fd-foreground shadow-sm' : 'text-fd-muted-foreground'
      }`}>
      {children}
    </button>
  );
}
