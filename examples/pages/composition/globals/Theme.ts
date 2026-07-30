import State from '@expressive/react';

export class Theme extends State {
  // Global by nature: there is only one document to paint.
  static global = true;

  dark = prefersDark();

  toggle() {
    this.dark = !this.dark;
  }

  protected new() {
    return this.get(({ dark }) => {
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    });
  }
}

// The document arrives already themed - by the page hosting this example, or by
// the OS. Read that first, because the effect above paints on activation and
// would otherwise light up a dark page until the first toggle.
function prefersDark() {
  const { theme } = document.documentElement.dataset;

  if (theme) return theme === 'dark';

  return matchMedia('(prefers-color-scheme: dark)').matches;
}
