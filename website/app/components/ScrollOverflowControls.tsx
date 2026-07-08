import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollOverflowControlsProps {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  leftLabel: string;
  rightLabel: string;
  onScrollLeft: () => void;
  onScrollRight: () => void;
  hideAt?: string;
}

export default function ScrollOverflowControls({
  canScrollLeft,
  canScrollRight,
  leftLabel,
  rightLabel,
  onScrollLeft,
  onScrollRight,
  hideAt = '',
}: ScrollOverflowControlsProps) {
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-[6em] rounded-l-[999px] bg-[linear-gradient(to_right,var(--tab-scroll-bg)_0%,color-mix(in_oklab,var(--tab-scroll-bg)_96%,transparent)_24%,color-mix(in_oklab,var(--tab-scroll-bg)_64%,transparent)_58%,transparent)] transition-opacity duration-200 ${hideAt} ${
          canScrollLeft ? 'opacity-100' : 'opacity-0'
        }`}>
      </div>
      <button
        type="button"
        aria-label={leftLabel}
        tabIndex={canScrollLeft ? 0 : -1}
        onClick={onScrollLeft}
        className={`absolute left-[0.25em] top-1/2 flex size-[1.75em] -translate-y-1/2 items-center justify-center rounded-full bg-(--tab-scroll-bg) text-fd-foreground transition-[opacity,background-color,box-shadow] duration-200 hover:bg-fd-background/80 hover:shadow-sm focus-visible:bg-fd-background/80 focus-visible:shadow-sm ${hideAt} ${
          canScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}>
        <ChevronLeft className="size-[1em]" />
      </button>

      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-[6em] rounded-r-[999px] bg-[linear-gradient(to_left,var(--tab-scroll-bg)_0%,color-mix(in_oklab,var(--tab-scroll-bg)_96%,transparent)_24%,color-mix(in_oklab,var(--tab-scroll-bg)_64%,transparent)_58%,transparent)] transition-opacity duration-200 ${hideAt} ${
          canScrollRight ? 'opacity-100' : 'opacity-0'
        }`}>
      </div>
      <button
        type="button"
        aria-label={rightLabel}
        tabIndex={canScrollRight ? 0 : -1}
        onClick={onScrollRight}
        className={`absolute right-[0.25em] top-1/2 flex size-[1.75em] -translate-y-1/2 items-center justify-center rounded-full bg-(--tab-scroll-bg) text-fd-foreground transition-[opacity,background-color,box-shadow] duration-200 hover:bg-fd-background/80 hover:shadow-sm focus-visible:bg-fd-background/80 focus-visible:shadow-sm ${hideAt} ${
          canScrollRight ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}>
        <ChevronRight className="size-[1em]" />
      </button>
    </>
  );
}
