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

Suspense fits load-once data the view cannot render without. Keep explicit `loading` / `error` fields when the fetch is user-initiated, stale content stays visible during refresh, or errors render inline - see [set.md](../field/set.md).

## Domain Rows in a Pool

State about a collection entry lives on the entry's class, spawned thru a `has` pool - not id-keyed records or `(id, value)` methods on the page. Factory takes the API payload (DTO in); page keeps fetch, the pool, and selection *policy*:

```tsx
import State, { Component, get, has, set } from '@expressive/react';

class Message extends Component {
  info = set<MessageDto>();   // payload stays one subobject - not exploded per key
  id = set<string>();
  selected = false;
  inbox = get(Inbox);

  toggle(event: MouseEvent) {
    this.inbox.select(this, event);  // policy stays on the page
  }

  async archive() {
    await api.archive(this.id);
    this.inbox.messages.delete(this);
  }

  render() {
    const {
      selected,
      info: {
        sender,
        subject,
      },
    } = this;

    return (
      <button className={selected ? 'row on' : 'row'} onClick={this.toggle}>
        <b>{sender}</b> {subject}
      </button>
    );
  }
}

class Inbox extends Component {
  messages = has((dto: MessageDto) => new Message({ info: dto, id: dto.id }));

  get selected() {
    return this.messages.filter((m) => m.selected);
  }

  async refresh() {
    const data = await api.list();
    this.messages.clear();
    for (const dto of data) this.messages.add(dto);
  }

  select(message: Message, event: MouseEvent) { /* shift/meta multi-select */ }
}

function MessageList({ list }: { list: Message[] }) {
  return <div className="messages">{list}</div>;
}
```

Activated Components are React elements: the pool `{inbox.messages}` and plain subsets `{list}` place directly, no `.map`. Each row paints from its own `render()` subscription - selecting one message re-renders one row.

A cross-cutting subset can be a second pool instead of a member flag - class-mode `add` admits ready-made members; `pool.has(value)` tracks that member only. Members evict on destroy, so refill clears the subset - use a durable key when selection must survive refresh:

```tsx
class Inbox extends Component {
  messages = has((dto: MessageDto) => new Message({ info: dto, id: dto.id }));
  selected = has(Message);   // holds members of `messages` as guests
}

// on the row
get selected() {
  return this.inbox.selected.has(this);
}
```

**Anti-pattern:** `void selected;` in an FC to force tracking of member fields. Consume the value in JSX, or move paint into the row's `render()`.

## Form Chips in a Pool

The same shape covers form entries with their own async lifecycle - an upload, a pending download, an applied filter. The chip owns that lifecycle: started in `new()`, handle in an unmanaged field, torn down on destroy. The form owns the pool and readiness, reading DTOs back out at the API boundary:

```tsx
class Attachment extends Component {
  file = set<File>();
  job?: UploadJob;
  composer = get(Composer);
  stop = put<(() => void) | null>(null);  // unmanaged - see state/state.md

  get uploading() {
    return !this.job?.done;
  }

  protected new() {
    this.stop = api.upload(this.file, (job) => { this.job = job; });
    return () => this.stop?.();
  }

  toApi(): AttachmentDto {
    return { name: this.file.name, url: this.job!.url };
  }

  remove() {
    this.composer.attachments.delete(this);
  }

  render() { /* chip: name, progress, remove */ }
}

class Composer extends State {
  subject = '';
  attachments = has((file: File) => new Attachment({ file }));

  get ready() {
    return !this.attachments.any((a) => a.uploading);
  }

  get attachmentDtos() {
    return this.attachments.map((a) => a.toApi());
  }
}
```

The owner coordinates readiness only. A method re-finding a chip by id to feed it progress belongs on the chip.

## Region Controllers

When a page State accumulates unrelated clusters - draft fields plus lookups plus request state plus navigation - split each into its own State owned as a field. A feature region is unpluggable - pool, display state, and chrome travel with its import. Ownership provides implicitly; views bind the region directly:

```tsx
class ComposePage extends Component {
  composer = new Composer();  // owned field - provided with the page
  busy = false;

  get canSend() {
    return this.composer.ready && !this.busy;
  }

  async send() { /* composer -> request -> thread */ }
}

// Form sections bind the region; the footer mixes both
function SubjectField() {
  const { is: composer, subject } = Composer.get();
  ...
}

function Footer() {
  const { canSend, send } = ComposePage.get();
  ...
}
```

The page remains orchestrator - route identity, session, request dispatch, page-level errors. Split when the second cluster appears, not as late cleanup.

Children of a region `.get()` the region, never the page above it and back down. Facts they repeat become getters on the region; nested config they keep unpacking is forwarded once (`get config() { return this.page.composer; }`), named for the local scope.

## Bridging an Existing Router

Bridge, don't replace: a conversion keeps the app's router; adopting `@expressive/router` needs explicit go-ahead. An outer FC reads router hooks and passes props; alternatively the class encapsulates hooks itself with `use()` (see [react.md](react.md)):

```tsx
function InboxRoute() {
  const navigate = useNavigate();
  const { folder } = useParams();

  return (
    <Inbox navigate={navigate} urlFolder={folder}>
      <Toolbar />
      <Messages />
    </Inbox>
  );
}
```

Route params are props, not always working identity. When leaving a route must not clear the model, keep the working field separate and soft-sync with a reaction:

```tsx
class ComposePage extends Component {
  threadId?: string;     // working identity - survives route changes
  urlThreadId?: string;  // route param - undefined off /t/:id

  mount() {
    return this.get(($) => {
      void $.urlThreadId;  // declare the trigger - legitimate in model effects, never in renders
      this.syncRoute();
    });
  }

  async send() {
    const tid = this.threadId ??= createId();       // working field leads
    this.navigate(`/t/${tid}`, { replace: true });  // navigation confirms, never informs
    ...
  }
}
```

Assign the working field the moment identity is created. Fresh ids threaded thru arguments, or a shadow field remembering the last route - the working field is still a mirror.

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

Inverse for a self-contained widget: the parent mounts `<PermissionBar />` unconditionally; the bar reads `Pairing.get()` and falls thru when `permission` is unset. `cond && <Foo />` in a parent render is a moderate signal Foo should own the gate.

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
