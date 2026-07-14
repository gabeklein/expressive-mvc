import type React from 'react';
import Reveal from '@/components/Reveal';

export function Product() {
  return (
    <section id="product" className="panel px-6 lg:px-[50px]">
      <div className="mx-auto grid max-w-(--content-width) gap-12 py-16 md:py-24 xl:grid-cols-[minmax(26rem,0.7fr)_minmax(0,1.3fr)] xl:gap-12">
        <div className="mx-auto max-w-2xl text-center xl:self-center">
          <div className="mb-3 text-xs uppercase tracking-widest text-fd-primary">
            What Expressive adds
          </div>
          <h2 className="mb-5 font-display text-3xl font-bold tracking-tight md:text-4xl">
            <span className="md:whitespace-nowrap">React renders your app.</span><br />
            <span className="md:whitespace-nowrap">MVC keeps it organized.</span>
          </h2>
          <p className="text-lg leading-relaxed text-fd-muted-foreground">
            Expressive MVC is a model layer for your app. It gives data, async and
            side effects a home away from display logic.
            Components stay simple and behavior easy to read, write and debug.
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-180 grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 sm:gap-x-8">
          <Point title="Smaller components" illustration={<SmallerComponents />} delay={0}>
            Focus on the display logic, not coordinating features.
          </Point>
          <Point title="Separated concerns" illustration={<BuiltInSeparation />} delay={300}>
            Break up features so
            growth isn't tech debt.
          </Point>
          <Point title="Less Ceremony" illustration={<MinimalBoilerplate />} delay={100}>
            Normal logic, without the factories and wrappers.
          </Point>
          <Point title="Higher Clarity" illustration={<ReadableOutput />} delay={200}>
            Review agent output with confidence, not gymnastics.
          </Point>
        </div>
      </div>
    </section>
  );
}

function Point({
  title,
  children,
  illustration,
  delay,
}: {
  title: string;
  children: React.ReactNode;
  illustration: React.ReactNode;
  delay: number;
}) {
  return (
    <Reveal
      delay={delay}
      className="flex items-start gap-x-5 gap-y-3 pt-4 lg:items-center">
      <div className="h-14 shrink-0 text-fd-muted-foreground" aria-hidden>
        {illustration}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="max-w-46 text-sm leading-relaxed text-balance text-fd-muted-foreground sm:text-base">
          {children}
        </p>
      </div>
    </Reveal>
  );
}

const illustrationClass = 'h-14 w-20 overflow-visible';

function SmallerComponents() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <rect x="2" y="7" width="28" height="42" rx="5" fill="currentColor" className="opacity-[.17] dark:opacity-[.13]" />
      <path d="M8 15h16M8 24h11M8 32h16M8 41h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".3" />
      <path d="M35 28h8m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".3" />
      <rect x="49" y="4" width="29" height="14" rx="4" fill="var(--color-fd-primary)" className="opacity-[.22] dark:opacity-[.16]" />
      <rect x="49" y="21" width="29" height="14" rx="4" fill="var(--color-fd-primary)" className="opacity-[.22] dark:opacity-[.16]" />
      <rect x="49" y="38" width="29" height="14" rx="4" fill="var(--color-fd-primary)" className="opacity-[.22] dark:opacity-[.16]" />
      <path d="M55 11h13M55 28h17M55 45h10" stroke="var(--color-fd-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MinimalBoilerplate() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <rect x="4" y="7" width="72" height="42" rx="6" fill="currentColor" className="opacity-[.17] dark:opacity-[.13]" />
      <text
        x="39"
        y="35"
        fill="currentColor"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="22"
        letterSpacing="-4"
        textAnchor="middle"
        opacity=".38">([{'{}'}])</text>
    </svg>
  );
}

function ReadableOutput() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <path d="M3 12h16M8 21h8M20 21h9M2 30h14M11 39h17M5 48h4M13 48h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".26" />
      <path d="M34 28h8m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".3" />
      <rect x="48" y="5" width="30" height="46" rx="6" fill="var(--color-fd-primary)" className="opacity-20 dark:opacity-[.14]" />
      <path d="M54 15h15M54 23h10M54 31h18M54 39h13" stroke="var(--color-fd-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BuiltInSeparation() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <rect x="2" y="7" width="29" height="42" rx="5" fill="currentColor" className="opacity-[.17] dark:opacity-[.13]" />
      <path d="M8 16h17M8 24h10M8 32h16M8 40h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".28" />
      <path d="M37 28h8m-3-3 3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".3" />
      <rect x="49" y="3" width="29" height="20" rx="5" fill="var(--color-fd-primary)" className="opacity-20 dark:opacity-[.14]" />
      <rect x="49" y="33" width="29" height="20" rx="5" fill="var(--color-fd-primary)" className="opacity-20 dark:opacity-[.14]" />
      <path d="M55 10h16M55 17h10M55 40h11M55 47h17" stroke="var(--color-fd-primary)" strokeWidth="2" strokeLinecap="round" />
      <path d="M59 25v5m-2-2 2 2 2-2M68 31v-5m-2 2 2-2 2 2" stroke="var(--color-fd-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
    </svg>
  );
}
