import { Component, Model } from '@expressive/mvc';

export class Global extends Component {
  viewport = new Viewport();
  session = new Session();
  theme = new Theme();
}

export class Viewport extends Model {
  width = window.innerWidth;

  get compact() {
    return this.width < 600;
  }

  protected new() {
    const update = () => (this.width = window.innerWidth);

    window.addEventListener('resize', update);

    return () => window.removeEventListener('resize', update);
  }
}

export class Session extends Model {
  user: string | null = null;

  login() {
    this.user = 'Ada';
  }

  logout() {
    this.user = null;
  }
}

export class Theme extends Model {
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

// Read the theme the document already has, or the effect above paints
// light over a dark page on activation.
function prefersDark() {
  const { theme } = document.documentElement.dataset;

  if (theme) return theme === 'dark';

  return matchMedia('(prefers-color-scheme: dark)').matches;
}
