const CHIP =
  'mr-[3px] rounded-sm border border-fd-border bg-fd-muted px-1 py-px font-mono text-[0.85em] font-normal';

export default function CodeLabel({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return label.split('`').map((part, i) =>
    i % 2 ? (
      <code key={i} className={className ? `${CHIP} ${className}` : CHIP}>
        {part}
      </code>
    ) : (
      part
    )
  );
}
