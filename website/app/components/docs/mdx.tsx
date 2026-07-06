import type React from 'react';
import { Children, isValidElement, lazy, Suspense } from 'react';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import BaseCompare from '@/components/Compare';

const LazyPlayground = lazy(() => import('./Playground'));

interface CompareProps {
  labels: string[];
  wide?: boolean;
  children: React.ReactNode;
}

export function Compare({ labels, wide, children }: CompareProps) {
  const panels = Children.toArray(children).filter(isValidElement);
  const sides = panels.map((node, i) => ({
    label: labels[i] ?? `#${i + 1}`,
    code: () => node as React.ReactElement
  }));

  if (sides.length < 2)
    throw new Error('<Compare> expects at least two code blocks as children.');

  return (
    <div className="not-prose my-6">
      <BaseCompare stacked={!wide} left={sides[0]} right={sides.slice(1)} />
    </div>
  );
}

export function Playground(props: { of: string; height?: number }) {
  return (
    <Suspense
      fallback={
        <div
          style={{ height: props.height ?? 480 }}
          className="my-6 flex items-center justify-center rounded-xl border border-fd-border text-fd-muted-foreground">
          Loading sandbox...
        </div>
      }>
      <LazyPlayground {...props} />
    </Suspense>
  );
}

export const docsComponents = {
  Compare,
  Playground,
  Tabs,
  Tab,
  Steps,
  Step
};
