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
    super(args, () => this.apply())

    let saved: string | null = null;

    try {
      saved = localStorage.getItem(KEY);
    } catch {}

    this.mode = saved as Mode || 'system';
  }

  toggle() {
    this.mode = next[this.mode];
    this.apply();
  }

  apply() {
    const { mode } = this;
    const { dataset } = document.documentElement;

    if (mode === 'system') delete dataset.theme;
    else dataset.theme = mode;

    try {
      localStorage.setItem(KEY, mode);
    } catch {}
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