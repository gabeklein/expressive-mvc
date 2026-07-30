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

        <div className="mx-auto grid w-full max-w-180 grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-8">
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
      className="flex flex-wrap items-start gap-x-5 gap-y-3 pt-4 lg:flex-nowrap lg:items-center">
      <div className="h-14 shrink-0 text-fd-muted-foreground pl-2" aria-hidden>
        {illustration}
      </div>
      <div className="min-w-54 max-w-54 flex-1">
        <h3 className="mb-1 font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-balance text-fd-muted-foreground sm:text-base">
          {children}
        </p>
      </div>
    </Reveal>
  );
}

const illustrationClass = 'h-14 w-20 overflow-visible';

const RED = '#ff375f';
const ORANGE = '#ff9f0a';
const GREEN = '#30d158';
const BLUE = '#0a84ff';
const VIOLET = '#bf5af2';
const CYAN = '#64d2ff';

const noise = 'opacity-70 dark:opacity-80';
const panel = 'opacity-[.17] dark:opacity-[.13]';
const resolved = 'opacity-[.22] dark:opacity-[.18]';

function Arrow({ x }: { x: number }) {
  return (
    <path
      d={`M${x} 28h8m-3-3 3 3-3 3`}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity=".3"
    />
  );
}

function SmallerComponents() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <rect x="2" y="7" width="28" height="42" rx="5" fill="currentColor" className={panel} />
      <g strokeWidth="2" strokeLinecap="round" className={noise}>
        <path d="M8 15h16" stroke={RED} />
        <path d="M8 24h11" stroke={ORANGE} />
        <path d="M8 32h16" stroke={GREEN} />
        <path d="M8 41h13" stroke={BLUE} />
      </g>
      <Arrow x={35} />
      <g fill="var(--accent)" className={resolved}>
        <rect x="49" y="4" width="29" height="14" rx="4" />
        <rect x="49" y="21" width="29" height="14" rx="4" />
        <rect x="49" y="38" width="29" height="14" rx="4" />
      </g>
      <path d="M55 11h13M55 28h17M55 45h10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MinimalBoilerplate() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <rect x="4" y="7" width="72" height="42" rx="6" fill="currentColor" className={panel} />
      <text
        x="39"
        y="35"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="22"
        letterSpacing="-4"
        textAnchor="middle"
        className={noise}>
        <tspan fill={RED}>(</tspan>
        <tspan fill={ORANGE}>[</tspan>
        <tspan fill={GREEN}>{'{'}</tspan>
        <tspan fill={CYAN}>{'}'}</tspan>
        <tspan fill={BLUE}>]</tspan>
        <tspan fill={VIOLET}>)</tspan>
      </text>
    </svg>
  );
}

function ReadableOutput() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <g strokeWidth="2" strokeLinecap="round" className={noise}>
        <path d="M3 12h16" stroke={RED} />
        <path d="M8 21h8" stroke={ORANGE} />
        <path d="M20 21h9" stroke={VIOLET} />
        <path d="M2 30h14" stroke={GREEN} />
        <path d="M11 39h17" stroke={BLUE} />
        <path d="M5 48h4" stroke={CYAN} />
        <path d="M13 48h10" stroke={RED} />
      </g>
      <Arrow x={34} />
      <rect x="48" y="5" width="30" height="46" rx="6" fill="var(--accent)" className={resolved} />
      <path d="M54 15h15M54 23h10M54 31h18M54 39h13" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BuiltInSeparation() {
  return (
    <svg viewBox="0 0 80 56" className={illustrationClass} fill="none">
      <rect x="2" y="7" width="29" height="42" rx="5" fill="currentColor" className={panel} />
      <g strokeWidth="2" strokeLinecap="round" className={noise}>
        <path d="M8 16h17" stroke={GREEN} />
        <path d="M8 24h10" stroke={RED} />
        <path d="M8 32h16" stroke={BLUE} />
        <path d="M8 40h12" stroke={ORANGE} />
      </g>
      <Arrow x={37} />
      <g className={resolved}>
        <rect x="49" y="3" width="29" height="20" rx="5" fill="var(--accent)" />
        <rect x="49" y="33" width="29" height="20" rx="5" fill={BLUE} />
      </g>
      <path d="M55 10h16M55 17h10" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      <path d="M55 40h11M55 47h17" stroke={BLUE} strokeWidth="2" strokeLinecap="round" />
      <path d="M59 25v5m-2-2 2 2 2-2M68 31v-5m-2 2 2-2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".45" />
    </svg>
  );
}
