import State from '@expressive/react';
import { Moon, Sun, SunMoon } from 'lucide-react';

import styles from './Theme.module.css';

type Mode = 'system' | 'light' | 'dark';

const KEY = 'expressive-examples-theme';
const next: Record<Mode, Mode> = {
  system: 'light',
  light: 'dark',
  dark: 'system'
};

export class Theme extends State {
  mode: Mode;

  constructor(...args: State.Args){
    super(args, () => {
      this.apply(document.documentElement);
    })

    let saved: string | null = null;

    try {
      saved = localStorage.getItem(KEY);
    } catch {}

    this.mode = saved as Mode || 'system';
  }

  toggle() {
    const now = this.mode = next[this.mode];
    this.apply(document.documentElement);

    try {
      localStorage.setItem(KEY, now);
    } catch {}
  }

  apply(root?: HTMLElement | null) {
    if (!root) return;

    const { mode } = this;

    if (mode === 'system') delete root.dataset.theme;
    else root.dataset.theme = mode;
  }

  get paint() {
    void this.mode; // subscribe mode to refresh
    return (frame: HTMLIFrameElement | null) =>
      this.apply(frame?.contentDocument?.documentElement);
  }
}

export default function Toggle() {
  const { mode, toggle } = Theme.get();
  const Icon =
    mode === 'system' ? SunMoon : mode === 'light' ? Sun : Moon;

  return (
    <button
      className={styles.theme}
      type="button"
      aria-label={`Switch to ${next[mode]} theme`}
      title={`Theme: ${mode}`}
      onClick={toggle}>
      <Icon aria-hidden="true" size={16} strokeWidth={2} />
    </button>
  );
}