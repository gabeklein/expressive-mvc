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
const SWIPE = 48;

export default function Compare({ left, right }: CompareProps) {
  const [tab, setTab] = useState(0);
  const [face, setFace] = useState(0);
  const stack = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const active = right[Math.min(tab, right.length - 1)];
  const Left = left.code;
  const Right = active.code;

  const select = (i: number) => {
    if (i === 0) {
      setFace(0);
    } else {
      setTab(i - 1);
      setFace(1);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;

    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;

    if (Math.abs(dx) < SWIPE || Math.abs(dy) > Math.abs(dx)) return;

    const pane = stack.current && stack.current.children[face];
    const scroller =
      pane &&
      Array.from(pane.querySelectorAll('*')).find(
        (el) => el.scrollWidth > el.clientWidth + 1,
      );

    if (dx < 0 && face === 0) {
      if (!scroller || scroller.scrollLeft >= scroller.scrollWidth - scroller.clientWidth - 2)
        setFace(1);
    } else if (dx > 0 && face === 1) {
      if (!scroller || scroller.scrollLeft <= 2)
        setFace(0);
    }
  };

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

        <div
          ref={stack}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="compare-static grid">
          <div
            className="col-start-1 row-start-1 transition-opacity duration-300 motion-reduce:transition-none"
            style={{ opacity: face ? 0 : 1, pointerEvents: face ? 'none' : 'auto' }}>
            <Left {...LN} />
          </div>
          <div
            className="col-start-1 row-start-1 transition-[clip-path] duration-300 motion-reduce:transition-none"
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
