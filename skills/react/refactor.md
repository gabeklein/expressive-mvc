# Refactoring React to Expressive MVC - The Golden Path

Read this in full before converting hook-based React code. The most common failure is knowing every API yet still translating hooks one-for-one - producing setter methods, drilled props, and over-promoted getters that mirror the old architecture instead of replacing it. Ownership comes first, translation second, and the checklist at the end audits the result.

Examples follow the conventions in [style.md](style.md).

## 1. Identify owners before touching hooks

List the stateful concerns in the code being converted - not the hooks, the *concerns*: a multi-step workflow, a settings draft, a preview toggle, a network resource. Each concern gets exactly one owner. Only after the owner list is stable should any hook be touched.

## 2. Separate headless workflow from display-intrinsic state

Network operations, domain rules, and cross-view coordination are headless - they would exist without this UI. Preview modes, confirmation checkboxes, and selections that only drive one subtree are display-intrinsic. These end up in different classes even when the original component held them in adjacent `useState` calls.

## 3. Choose `State`, `Component`, or a plain FC

- Headless workflow -> `State`, provided via context.
- Display-intrinsic state -> `Component` owning that subtree, acquiring the workflow through an instruction.
- Simple presentation -> plain function component.

```tsx
export class TransferState extends State {
  step: WizardStep = 'location';
  busy = false;
  result: GenerateResponse | null = null;

  get selectedLocation() {
    return this.locations.find((l) => l.site === this.selectedSite);
  }

  async generate() { /* network + coordination */ }
}

export class ReviewStep extends Component {
  transfer = get(TransferState);
  previewMode: 'table' | 'raw' = 'table';
  confirmed = false;

  render() {
    return (
      <article className="panel review">
        <ReviewSummary />
        <ReviewNotices />
        <ReviewActions />
      </article>
    );
  }
}
```

**Anti-pattern - the reflexive split.** Creating `ReviewState` plus a `ReviewView` FC because the old code had hooks. If the fields exist only to support one rendered surface, they belong on the `Component` that renders it.

**Anti-pattern - subcomponent overuse.** The sections composed in `render()` above are freestanding FCs, not PascalCase methods on the class. Subcomponents (`<this.Header />`) are extension points - machinery for subclasses to replace or wrap. The test: **would a subclass reasonably replace or wrap this renderer?** For ordinary implementation scopes the answer is no, and a freestanding FC calling `ReviewStep.get()` is clearer. See [component.md](component.md).

## 4. Provide classes directly

```tsx
// Wrong: instance created only to be provided
function App() {
  const transfer = TransferState.use();
  return (
    <Provider for={transfer}>
      <TransferPage />
    </Provider>
  );
}

// Right: the class is the Provider target
function App() {
  return (
    <Provider for={TransferState}>
      <TransferPage />
    </Provider>
  );
}
```

Provide an instance only when preconfiguration or external ownership genuinely requires it.

## 5. Move source state and behavior; do not translate setters

Mapping for what remains after ownership is settled:

- Values written by user input, browser events, timers, or network callbacks -> mutable class fields.
- `useMemo` values and effects that only sync state -> class getters.
- `useEffect` setup/teardown -> `protected new()` returning cleanup.
- `useCallback` handlers -> auto-bound class methods.

Reactive fields are assigned directly - do not manufacture setters:

```tsx
// Wrong: hook setters mechanically translated
class TransferState extends State {
  username = '';

  setUsername(value: string) {
    this.username = value;
  }
}

// Right: assignment is the API
onChange={(event) => (transfer.username = event.target.value)}
```

Keep a method when the write enforces policy - validation, normalization, coordinating fields, triggering behavior:

```tsx
setStartDate(startDate: string) {
  this.range = {
    startDate,
    endDate: this.range.endDate && this.range.endDate < startDate
      ? startDate
      : this.range.endDate,
  };
}
```

Audit rule: **delete any method whose body is only `this.field = value`.** It adds vocabulary without adding policy.

## 6. Getters: shared and semantic only

A derived value earns a getter on shared state when it is read by multiple consumers, expresses domain or workflow meaning, is expensive enough to merit memoized tracking, or is part of the state's API:

```tsx
get hasBlocking() {        // read by notices, actions, and header
  return this.blocking > 0;
}

get hasSavedWssAccess() {  // domain meaning, multiple consumers
  ...
}
```

A calculation feeding a single view belongs in that view, next to its snapshot:

```tsx
// Wrong: display-only value promoted to shared state
class TransferState extends State {
  get selectedStepIndex() {
    return STEPS.indexOf(this.step);
  }
}

// Right: the one consumer derives it locally
function StepIndicator() {
  const { step } = TransferState.get();
  const index = STEPS.indexOf(step);
  ...
}
```

## 7. Kill prop drilling

Contextual children declare their own dependencies with `.get()`. Do not preserve the prop contracts the hook implementation needed:

```tsx
// Wrong: converted, but still carries the old plumbing
function ReviewActions({
  confirmed,
  hasBlocking,
  busy,
  onConfirm,
  onDownload,
  onBack,
}: ReviewActionsProps) { ... }

// Right: dependencies are local
function ReviewActions() {
  const {
    confirmed,
    hasBlocking,
    downloadIif,
    transfer,
  } = ReviewStep.get();
  ...
}
```

Pure presentation components (a `Metric`, a `StatusCallout`) may still take plain props - context replaces drilled *state*, not every value.

## 8. Destructure an exact dependency snapshot

Every `.get()` / `.use()` opens the component with the exact reactive values it renders, nested levels included, optional objects defaulted in place:

```tsx
// Wrong: deep reads scattered through JSX, one hidden in a branch
function JournalOverview() {
  const review = ReviewStep.get();

  return (
    <section>
      <dd>{review.result.artifact.config.accountFile}</dd>
      <dd>{new Date(review.result.artifact.generatedAt).toLocaleString()}</dd>
      {review.showRaw && <pre>{review.result.iif}</pre>}
    </section>
  );
}

// Right: the full dependency surface, declared once at the top
function JournalOverview() {
  const {
    showRaw,
    result: {
      iif,
      artifact: {
        generatedAt,
        config: {
          accountFile,
        },
      },
    },
  } = ReviewStep.get();
  ...
}
```

Three reasons this is the norm:

1. A reviewer sees the component's complete dependency surface at the top.
2. Trapped getters are traversed once instead of re-walked per expression.
3. Reads create subscriptions - a deep read inside a branch subscribes only on renders where the branch runs (a **conditional subscription**), and reads inside event handlers never subscribe at all. The snapshot makes the surface deterministic.

The same applies to `this` inside `Component.render()` and subcomponents: destructure what the section reads at the top - the rendering shares its subscription plumbing with the hooks.

## 9. Write through the proxy; use `is` sparingly

Subscription proxies pass assignments through to the real instance. Three shapes cover every case:

```tsx
const transfer = TransferState.get();            // whole object is the only need

const { transfer, confirmed } = ReviewStep.get(); // nested object from a snapshot -
onClick={() => (transfer.step = 'generate')}      // writes are transparent

const { is: review, confirmed } = ReviewStep.get(); // root object + sibling values:
                                                     // only here does `is` earn its place
```

**Anti-pattern:** aliasing `is` whenever anything will be written. Writes do not need the raw instance - unwrapping nested objects through `is` is noise.

## 10. Put presence gates at the call site

When content requires values that may not exist yet, the parent owns the render gate and the child asserts its invariant with `.get(true)`:

```tsx
// Wrong: child destructures a maybe-value and bails internally
function SettingsEditor() {
  const { draft, saving } = SettingsState.get();
  if (!draft) return null;
  ...
}

// Right: parent gates, child asserts
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
  ...
}
```

Declare gateable fields optional (`draft?: SettingsLocation`), not `| null` - `get(true)` rejects only `undefined`, and `Required<T>` does not strip `null` from unions.

## 11. Extract, then consolidate

A conditional JSX branch above roughly ten lines or five component levels is a signal to give it its own named scope - a heuristic, not a mandate. Then apply the inverse: **recombine scopes that share the same dependencies, read locally, and contain no nested decision logic.** Splitting every fragment creates navigation overhead without clarifying ownership.

```tsx
// Consolidated: both branches read the same ReviewStep context,
// neither contains nested logic - one scope, not three
function Exceptions() {
  const {
    exceptions,
    feeExceptions,
    hasBlocking,
  } = ReviewStep.get();

  if (hasBlocking) {
    return <section className="exceptions">...</section>;
  }

  if (feeExceptions.length) {
    return <section className="fees">...</section>;
  }
}
```

When an early return would skip most of a declared snapshot, that is a signal the gated content wants its own component.

## 12. Audit with this checklist

- Is each state field owned at the narrowest useful scope?
- Does every getter have multiple consumers or semantic API value?
- Does every method do more than assign one field?
- Are contextual values still being drilled through props?
- Does every `.get()` / `.use()` show the exact nested dependency surface?
- Are any reactive deep reads hidden in conditional branches or handlers?
- Are nested destructures placed after direct properties?
- Is `is` used only where the root object must be retained alongside sibling destructuring?
- Can an optional child be gated by its parent and use `.get(true)`?
- Are Component subcomponents genuine extension points?
- Are large JSX branches named without fragmenting trivial shared logic?
