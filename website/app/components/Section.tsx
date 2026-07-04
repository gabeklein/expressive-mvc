import type React from 'react';

export default function Section({
  tint,
  children,
}: {
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`border-b border-fd-border ${tint ? 'bg-fd-muted/30' : ''}`}>
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        {children}
      </div>
    </section>
  );
}
