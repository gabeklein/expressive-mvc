import { Component } from '@expressive/react';
import { Monitor, Moon, Sun } from 'lucide-react';

import styles from './Theme.module.css';

type Mode = 'system' | 'light' | 'dark';

const KEY = 'expressive-examples-theme';
const next: Record<Mode, Mode> = {
  system: 'light',
  light: 'dark',
  dark: 'system'
};

export default class Theme extends Component {
  mode = read();

  protected new() {
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

  toggle() {
    this.mode = next[this.mode];
    this.apply();
  }

  render() {
    const { mode, toggle } = this;
    const Icon =
      mode === 'system' ? Monitor : mode === 'light' ? Sun : Moon;

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
}

function read(): Mode {
  let saved: string | null = null;

  try {
    saved = localStorage.getItem(KEY);
  } catch {}

  return saved === 'system' || saved === 'light' || saved === 'dark'
    ? saved
    : 'system';
}
