import React from 'react';

export default function Section({ tint, children }: {
  tint?: boolean;
  children: React.ReactNode;
}) {
  borderBottom: 1, solid;
  borderColor: $colorFdBorder;

  if (tint) {
    background: `color-mix(in srgb, var(--color-fd-muted) 30%, transparent)`;
  }

  inner: {
    margin: 0, auto;
    maxWidth: $contentWidth;
    padding: 96, 24;
  }

  return (
    <section>
      <div _inner>{children}</div>
    </section>
  );
}
