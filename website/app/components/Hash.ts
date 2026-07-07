import State from '@expressive/react';

// One window 'hashchange' listener for the whole page. Owns the current
// #slug and scrolls to a section whose id matches it - so deep-links and
// in-page anchors resolve on fresh load, past the webfont layout shift.
export class Hash extends State {
  active = '';

  protected new() {
    // skip if SSR
    if (typeof window === 'undefined') return;

    const sync = () => (this.active = window.location.hash.slice(1));

    sync();

    // Fresh load only: the browser's own anchor scroll fires before webfonts
    // settle and lands off-target, so re-scroll once fonts are ready. On later
    // navigations native anchor scrolling handles sections and Tabs reacts to
    // its own slugs - here we only track the value.
    if (this.active)
      document.fonts.ready.then(() => {
        const el = document.getElementById(this.active);
        el && el.scrollIntoView({ block: 'start' });
      });

    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }
}

Hash.new();
