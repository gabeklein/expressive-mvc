# Expressive MVC — Patterns

Recipes and examples for common patterns and use cases with Expressive MVC in React.

## Counter

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }
  decrement() {
    this.count--;
  }

  render() {
    return (
      <div>
        <button onClick={this.decrement}>-</button>
        <span>{this.count}</span>
        <button onClick={this.increment}>+</button>
      </div>
    );
  }
}
```

## Form with Validation

```tsx
import { Component } from '@expressive/react';

class LoginForm extends Component {
  email = '';
  password = '';

  get valid() {
    return this.email.includes('@') && this.password.length >= 8;
  }

  submit() {
    if (this.valid) postLogin(this.email, this.password);
  }

  render() {
    const { email, password, valid, submit } = this;

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}>
        <input
          value={email}
          onChange={(e) => (this.email = e.target.value)}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => (this.password = e.target.value)}
        />
        <button disabled={!valid}>Log In</button>
      </form>
    );
  }
}
```

## Async Data Fetching

```tsx
import { Component, set } from '@expressive/react';

class Profile extends Component {
  fallback = (<p>Loading...</p>);
  data = set(async () => {
    const res = await fetch('/api/user');
    return res.json();
  });

  render() {
    return (
      <div>
        <h1>{this.data.name}</h1>
        <p>{this.data.email}</p>
      </div>
    );
  }
}
```

Suspense fits load-once data the view cannot render without. Keep explicit `loading` / `error` fields when the fetch is user-initiated, stale content should stay visible during refresh, or errors render inline - see [set.md](../field/set.md).

## Domain Rows in a Pool

State about an entry in a collection lives on the entry's class, spawned through a `has` pool - not in id-keyed records or `(id, value)` methods on the page. The factory takes the API payload (DTO in); the page keeps fetch, the pool, and selection *policy*:

```tsx
import State, { Component, get, has, set } from '@expressive/react';

class GalleryImage extends Component {
  info = set<ImageMeta>();   // payload stays one subobject - not exploded per key
  name = set<string>();
  selected = false;
  gallery = get(GalleryPage);

  toggle(event: MouseEvent) {
    this.gallery.selectThumb(this, event);  // policy stays on the page
  }

  async remove() {
    await api.remove(this.name);
    this.gallery.images.delete(this);
  }

  render() {
    const {
      name,
      selected,
      info: {
        thumbUrl,
      },
    } = this;

    return (
      <button className={selected ? 'thumb on' : 'thumb'} onClick={this.toggle}>
        <img src={thumbUrl} alt={name} />
      </button>
    );
  }
}

class GalleryPage extends Component {
  images = has((meta: ImageMeta) => new GalleryImage({ info: meta, name: meta.name }));

  get selected() {
    return this.images.filter((i) => i.selected);
  }

  async refresh() {
    const data = await api.list();
    this.images.clear();
    for (const meta of data) this.images.add(meta);
  }

  selectThumb(image: GalleryImage, event: MouseEvent) { /* shift/meta multi-select */ }
}

function ThumbGrid({ list }: { list: GalleryImage[] }) {
  return <div className="thumbs">{list}</div>;
}
```

Activated Components are React elements: the pool (`{page.images}`) and plain subsets (`{list}`) place directly, no `.map`. Each row paints from its own `render()` subscription, so selecting one image re-renders one row.

A cross-cutting subset can be a second pool instead of a member flag - class-mode `add` admits ready-made members, and `pool.has(value)` tracks that member only:

```tsx
class GalleryPage extends Component {
  images = has((meta: ImageMeta) => new GalleryImage({ info: meta, name: meta.name }));
  selected = has(GalleryImage);   // holds members of `images` as guests
}

// on the row
get selected() {
  return this.gallery.selected.has(this);
}
```

**Anti-pattern:** `void selected;` in an FC to force tracking of member fields. Consume the value in JSX, or move paint into the row's `render()`.

## Form Chips in a Pool

The same shape covers form entries with their own async lifecycle - an upload, a pending download, an applied filter. The chip owns its status and removal; the form owns the pool and overall readiness, reading DTOs back out at the API boundary:

```tsx
class AppliedLora extends Component {
  file = set<string>();
  weight = 1;
  importJob?: ImportJob;
  recipe = get(RecipePanel);

  get importing() {
    return this.importJob?.phase === 'downloading';
  }

  toApi(): Lora {
    return { file: this.file, weight: this.weight };
  }

  remove() {
    this.recipe.loras.delete(this);
  }

  render() { /* card: weight nudge, progress, remove */ }
}

class RecipePanel extends State {
  loras = has((dto: Lora) => new AppliedLora(dto));

  get ready() {
    return !this.loras.any((l) => l.importing);
  }

  get loraDtos() {
    return this.loras.map((l) => l.toApi());
  }
}
```

## Region Controllers

When a page State accumulates unrelated clusters - form config plus catalog plus job plus navigation - split each into its own State owned as a field. Ownership provides implicitly; views bind the region directly:

```tsx
class GeneratePage extends Component {
  recipe = new RecipePanel();  // owned field - provided with the page
  busy = false;

  get canGenerate() {
    return this.recipe.ready && !this.busy;
  }

  async generate() { /* orchestrates: recipe -> job -> session */ }
}

// Form sections bind the region; the footer mixes both
function PromptFields() {
  const { is: recipe, prompt } = RecipePanel.get();
  ...
}

function Footer() {
  const { canGenerate, generate } = GeneratePage.get();
  ...
}
```

The page remains orchestrator - route identity, session, job dispatch, page-level errors. Split when the second cluster appears, not as a late cleanup.

## Bridging an Existing Router

An outer FC reads the router hooks and passes them as props; alternatively the class encapsulates the hooks itself with `use()` (see [react.md](react.md)):

```tsx
function GalleryRoute() {
  const navigate = useNavigate();
  const { sessionId } = useParams();

  return (
    <GalleryPage navigate={navigate} urlSessionId={sessionId}>
      <Toolbar />
      <Thumbs />
    </GalleryPage>
  );
}
```

Route params are props, not always working identity. When leaving a route must not clear the model, keep the working field separate and soft-sync with a reaction:

```tsx
class GeneratePage extends Component {
  sessionId?: string;     // working identity - survives route changes
  urlSessionId?: string;  // route param - undefined off /s/:id

  mount() {
    return this.get(($) => {
      void $.urlSessionId;  // declare the trigger - legitimate in model effects, never in renders
      this.syncRoute();
    });
  }
}
```

## Context Sharing

```tsx
import State, { Component, get, Provider } from '@expressive/react';

class Theme extends State {
  color = 'blue';
  toggle() {
    this.color = this.color === 'blue' ? 'red' : 'blue';
  }
}

class ThemedWidget extends Component {
  theme = get(Theme);

  render() {
    return (
      <div style={{ color: this.theme.color }}>
        Themed content
        <button onClick={this.theme.toggle}>Toggle</button>
      </div>
    );
  }
}

function App() {
  return (
    <Provider for={Theme}>
      <ThemedWidget />
    </Provider>
  );
}
```

## Contextual Children (No Prop Drilling)

Children of a provided state declare their own dependencies with `.get()`. Do not thread state values and callbacks through props:

```tsx
// Before: parent unpacks state and drills it down
function Wizard() {
  const { step, busy, canContinue, advance, retreat } = TransferState.get();
  return <WizardActions step={step} busy={busy} canContinue={canContinue}
    onNext={advance} onBack={retreat} />;
}

// After: the child is contextual - dependencies are local
function Wizard() {
  return <WizardActions />;
}

function WizardActions() {
  const {
    busy,
    canContinue,
    advance,
    retreat,
  } = TransferState.get();

  return (
    <footer>
      <button onClick={retreat} disabled={busy}>Back</button>
      <button onClick={advance} disabled={!canContinue}>Continue</button>
    </footer>
  );
}
```

Pure presentation components (a `Metric`, a badge) may still take plain props - context replaces drilled state, not every value.

## Presence Boundary

The parent owns whether an optional child exists; the child asserts its requirements with `.get(true)`. Declare the gated field optional (`draft?: T`), not `| null`:

```tsx
class SettingsState extends State {
  draft?: SettingsLocation = undefined;
  saving = false;

  async saveSettings() { ... }
}

function SettingsContent() {
  const { draft } = SettingsState.get();

  return (
    <div className="settings-layout">
      <LocationList />
      {draft && <SettingsEditor />}
    </div>
  );
}

function SettingsEditor() {
  const {
    saveSettings,
    saving,
    draft: {
      bankAccount,
      categoryAccounts,
    },
  } = SettingsState.get(true);

  return <section className="settings-editor">...</section>;
}
```

## Computed Values

```tsx
import { Component } from '@expressive/react';

class Cart extends Component {
  items: { name: string; price: number; qty: number }[] = [];

  get total() {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  get count() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  }

  add(name: string, price: number) {
    this.items = [...this.items, { name, price, qty: 1 }];
  }

  render() {
    return (
      <div>
        <p>
          {this.count} items - ${this.total}
        </p>
      </div>
    );
  }
}
```

## Debounced Search

```ts
import State, { set } from '@expressive/react';

class Search extends State {
  query = '';
  results: string[] = [];

  debouncedQuery = set('', (value) => {
    const timer = setTimeout(() => this.performSearch(value), 300);
    return () => clearTimeout(timer);
  });

  async performSearch(q: string) {
    const res = await fetch(`/api/search?q=${q}`);
    this.results = await res.json();
  }
}
```

## Downstream Collection

```tsx
import State, { Component, get } from '@expressive/react';

class Tab extends State {
  label = '';
  group = get(TabGroup);
}

class TabGroup extends Component {
  tabs = get(Tab, true); // collects all Tab instances below
  active = 0;

  render() {
    return (
      <div>
        {this.tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => (this.active = i)}
            style={{ fontWeight: this.active === i ? 'bold' : 'normal' }}>
            {tab.label}
          </button>
        ))}
      </div>
    );
  }
}
```

## Refactoring Hooks Into State

When converting React hooks, avoid a literal hook-for-field rewrite. Put mutable inputs in fields, derived values in getters, setup/cleanup in `new()`, and event handlers in methods.

```tsx
// Before: width is source state, compact is derived state kept in sync.
function LayoutBadge() {
  const [width, setWidth] = useState(window.innerWidth);
  const [compact, setCompact] = useState(width < 720);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setCompact(width < 720);
  }, [width]);

  return <span>{compact ? 'Compact' : `Wide (${width}px)`}</span>;
}
```

```tsx
// After: width is the source field, compact is a getter, and resize belongs to Viewport.
import State from '@expressive/react';

class Viewport extends State {
  width = window.innerWidth;

  get compact() {
    return this.width < 720;
  }

  protected new() {
    const update = () => {
      this.width = window.innerWidth;
    };

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }
}

function LayoutBadge() {
  const { width, compact } = Viewport.use();

  return <span>{compact ? 'Compact' : `Wide (${width}px)`}</span>;
}
```

## Effects & Cleanup

```ts
import State from '@expressive/react';

class Timer extends State {
  elapsed = 0;

  tick() {
    this.elapsed++;
  }

  protected new() {
    const id = setInterval(this.tick, 1000); // methods are auto-bound - no arrow wrapper
    return () => clearInterval(id);
  }
}
```

## Using State.get() with Computed Hook

```tsx
function OrderSummary() {
  const summary = Cart.get(($) => ({
    total: $.total,
    count: $.count,
    empty: $.items.length === 0
  }));

  if (summary.empty) return <p>Cart is empty</p>;
  return (
    <div>
      <p>{summary.count} items</p>
      <p>Total: ${summary.total}</p>
    </div>
  );
}
```
