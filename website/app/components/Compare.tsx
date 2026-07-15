import type React from 'react';
import State, { ref } from '@expressive/react';
import ScrollOverflowControls from './ScrollOverflowControls';
import code from './Snippet';

type Snippet = ReturnType<typeof code> | (() => React.ReactElement);

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
  canScrollTabsLeft = false;
  canScrollTabsRight = false;

  tabScroller = ref<HTMLDivElement>((el) => {
    let frame = 0;
    const media = window.matchMedia('(max-width: 767px)');

    const update = () => {
      frame = 0;
      const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
      this.canScrollTabsLeft = media.matches && el.scrollLeft > 1;
      this.canScrollTabsRight = media.matches && remaining > 1;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    el.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    media.addEventListener('change', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      media.removeEventListener('change', schedule);
    };
  });

  select(i: number) {
    if (i === 0) {
      this.face = 0;
    } else {
      this.tab = i - 1;
      this.face = 1;
    }
  }

  scrollTabs(direction: -1 | 1) {
    this.tabScroller.current?.scrollBy({
      left: direction * 160,
      behavior: 'smooth',
    });
  }

  updateTabScrollState() {
    const el = this.tabScroller.current;
    if (!el) return;

    const remaining = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    this.canScrollTabsLeft = mobile && el.scrollLeft > 1;
    this.canScrollTabsRight = mobile && remaining > 1;
  }
}

export default function Compare({ left, right }: CompareProps) {
  const {
    tab,
    face,
    select,
    tabScroller,
    canScrollTabsLeft,
    canScrollTabsRight,
    scrollTabs,
  } = Control.use();

  const active = right[Math.min(tab, right.length - 1)];
  const Left = left.code;
  const Right = active.code;

  const libTabs =
    right.length > 1 ? (
      <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {right.map((s, i) => (
          <button
            key={s.label}
            onClick={() => select(i + 1)}
            className={`shrink-0 rounded-full font-mono text-xs py-1 px-2.5 transition-colors ${
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
      <div className="compare-static hidden md:grid md:grid-cols-2 md:gap-5 md:items-start">
        <div className="min-w-0">
          <Head>
            <span className="text-sm font-semibold text-fd-primary">{left.label}</span>
            <span className="text-[11px] uppercase tracking-widest text-fd-muted-foreground">
              Expressive
            </span>
          </Head>
          <CodePanel snippet={Left} />
        </div>
        <div className="min-w-0">
          <Head>{libTabs}</Head>
          <CodePanel snippet={Right} />
        </div>
      </div>

      <div className="md:hidden">
        <div className="mb-3 [--tab-scroll-bg:color-mix(in_oklab,var(--color-fd-muted)_50%,transparent)]">
          <div className="relative w-fit max-w-full">
            <div
              ref={tabScroller}
              className="flex w-fit max-w-full gap-[0.25em] overflow-x-auto rounded-[999px] bg-(--tab-scroll-bg) p-[0.25em] text-base [scrollbar-width:none] sm:text-sm [&::-webkit-scrollbar]:hidden">
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

            <ScrollOverflowControls
              canScrollLeft={canScrollTabsLeft}
              canScrollRight={canScrollTabsRight}
              leftLabel="Scroll comparison tabs left"
              rightLabel="Scroll comparison tabs right"
              onScrollLeft={() => scrollTabs(-1)}
              onScrollRight={() => scrollTabs(1)}
            />
          </div>
        </div>

        <div className="compare-static">
          <CodePanel snippet={face ? Right : Left} />
        </div>
      </div>
    </div>
  );
}

function CodePanel({ snippet: Snippet }: { snippet: Snippet }) {
  const tokenCount = 'tokenCount' in Snippet ? Snippet.tokenCount : undefined;

  return (
    <div className="relative min-w-0">
      <Snippet {...LN} />
      {tokenCount !== undefined && (
        <span className="pointer-events-none absolute right-3 bottom-3 rounded bg-fd-card/90 px-1.5 py-0.5 font-mono text-[10px] text-fd-muted-foreground shadow-sm">
          ~{tokenCount} tokens
        </span>
      )}
    </div>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 min-h-10 px-1 mb-2">
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
      className={`shrink-0 whitespace-nowrap rounded-[999px] px-[1em] py-[0.625em] text-[inherit] leading-[1.5] font-medium transition-colors ${
        active ? 'bg-fd-background text-fd-foreground shadow-sm' : 'text-fd-muted-foreground'
      }`}>
      {children}
    </button>
  );
}
