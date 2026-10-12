# @expressive/cli

Reactive terminal apps from class components - an experiment in `@expressive/mvc` as a standalone UI framework. No React underneath: this package is its own `jsxImportSource`, with a bespoke reconciler over core's observable state and a line-oriented terminal backend.

```tsx
/* tsconfig: { "jsx": "react-jsx", "jsxImportSource": "@expressive/cli" } */
import { Component, render } from '@expressive/cli';

class Timer extends Component {
  elapsed = 0;

  new() {
    const timer = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(timer);
  }

  render() {
    return `elapsed: ${this.elapsed}s`;
  }
}

const app = render(<Timer />);
```

State changes repaint the frame in place when stdout is interactive; non-interactive output receives only the final frame. Suspense (`set()` placeholders) shows a component's `fallback` while pending; `catch` recovers from render errors.

Try the demo:

```bash
bun example/steps.tsx
```

See `skills/adapters/cli.md` for design notes and current limitations. Private and unpublished.
