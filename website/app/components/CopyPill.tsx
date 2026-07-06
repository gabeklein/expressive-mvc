import State from '@expressive/react';

class Copy extends State {
  copied = false;

  copy(command: string) {
    navigator.clipboard.writeText(command).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 1400);
    });
  }
}

export default function CopyPill({ label, command }: { label: string; command: string }) {
  const { copied, copy } = Copy.use();

  return (
    <button
      onClick={() => copy(command)}
      className="group flex items-center justify-between gap-4 rounded-lg border border-fd-border/70 dark:border-transparent bg-fd-muted py-2.5 px-4 text-left transition-colors hover:bg-fd-muted/70">
      <span className="flex flex-col">
        <span className="text-[11px] uppercase tracking-widest text-fd-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-sm">{command}</span>
      </span>
      <span className="text-xs text-fd-muted-foreground shrink-0">
        {copied ? 'copied' : 'copy'}
      </span>
    </button>
  );
}
