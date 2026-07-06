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
const SWIPE = 40;

export default function Compare({ left, right }: CompareProps) {
  const [tab, setTab] = useState(0);
  const [face, setFace] = useState(0);
  const startX = useRef<number | null>(null);

  const active = right[Math.min(tab, right.length - 1)];
  const Left = left.code;
  const Right = active.code;

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (dx < -SWIPE) setFace(1);
    else if (dx > SWIPE) setFace(0);
  };

  const leftHead = (
    <Head>
      <span className="text-sm font-semibold text-fd-primary">{left.label}</span>
      <span className="text-[11px] uppercase tracking-widest text-fd-muted-foreground">
        Expressive
      </span>
    </Head>
  );

  const rightHead = (
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
  );

  return (
    <div>
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
        <div>{leftHead}{<Left {...LN} />}</div>
        <div>{rightHead}{<Right {...LN} />}</div>
      </div>

      <div className="lg:hidden">
        <div className="flex gap-1 p-1 mb-3 w-max rounded-full bg-fd-muted/50">
          <Segment active={face === 0} onClick={() => setFace(0)}>
            Expressive
          </Segment>
          <Segment active={face === 1} onClick={() => setFace(1)}>
            The rest
          </Segment>
        </div>

        <div className="relative overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div
            className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${face * 100}%)` }}>
            <div className="w-full shrink-0">{leftHead}{<Left {...LN} />}</div>
            <div className="w-full shrink-0">{rightHead}{<Right {...LN} />}</div>
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
