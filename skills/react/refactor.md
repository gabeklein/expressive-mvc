# Refactoring React to Expressive MVC - The Golden Path

Read in full before converting hook-based React code. The common failure is translating hooks one-for-one - setter methods, drilled props, over-promoted getters mirroring the old architecture. Ownership first, translation second; the checklist at the end audits the result.

Examples follow the conventions in [style.md](style.md).

**Large apps:** convert route/page controllers and their domain pools first; leave mature leaf widgets (inputs, menus) on hooks until the parent domain is stable. Coexistence is fine mid-migration.

## Ambiguity defaults

A one-shot conversion cannot ask. Proceed on these defaults, declare deviations in the deliverable; ask only when an assumption would destroy something unrecoverable - a feature, a public API.

| Ambiguity | Default |
|---|---|
| "No redesigns" / parity scope | Observable behavior and public contracts; internal structure is the task |
| Does leaving a route clear its model? | Keep model alive; soft-sync working identity from params |
| Selection across refetch | Durable key + re-find getter; member references only in pools stable between fetches |
| Loading UX for user-initiated ops | Explicit loading/error fields; suspense for load-once data |
| File layout | Colocate feature folder once a route has model classes; existing convention wins |
| Verification gate | Currently-green checks only - a check broken at base is not yours to fix; report what was exercised |
| Bug or dead branch found at base | Preserve behavior and note it; drop only provably dead code, and say so |
| Routing | Bridge the existing router (step 7); adopting `@expressive/router` needs explicit go-ahead, never part of a conversion |
| Deliverable | Ownership map, assumptions taken, behavior deltas, filled checklist - in the PR or ledger |

## 1. Identify owners before touching hooks

List the stateful *concerns*, not the hooks: a multi-step workflow, a settings draft, a preview toggle, a network resource. Each gets exactly one owner. Touch no hook until the owner list is stable.

## 2. Separate headless workflow from display-intrinsic state

Headless - would exist without this UI: network operations, domain rules, cross-view coordination. Display-intrinsic: preview modes, confirmation checkboxes, selections driving one subtree. They go in different classes even when adjacent `useState` calls held them.

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

**Anti-pattern - the reflexive split.** `ReviewState` plus a `ReviewView` FC because the old code had hooks. Fields supporting one rendered surface belong on the `Component` rendering it.

**Anti-pattern - the pass-through Component.** A class whose only members are `foo = get(Foo)` and `render()` is an FC wearing an instance - snapshot `Foo.get()` instead. Component earns the class when the instance owns fields, a pool, or its boundary/suspense is wanted - lifecycle counts only when it manages owned state; a ref plus a DOM-sync reaction over context is still an FC. Same triage for shells: a singleton feature with no state of its own is an FC mounting its children (`<Sidebar /> <MessageList />`). Inversely, a leaf widget still on `useState`/`useEffect` whose inputs are its identity is a Component - `<Thumbnail src size />` writes the fields, `mount()` reacts to them.

**The app/route entrypoint is a Component** even when `render()` is pure composition - owning the construction graph is the state. The replica and each headless region are its fields; they provide implicitly, ship the last-resort boundary (`catch`, `fallback`), and are the introspection surface - a debugger or later agent reads the app's parts off the instance, not by walking Providers. `main` only mounts it: `createRoot(el).render(<Inbox />)` - no `Provider`, no `Session.new()` in bootstrap. "Stateless shell → FC" is a chrome rule; it never fires on the entrypoint.

The forms, by role:

| Thing | Form |
|---|---|
| App / route entrypoint | `Component` - owns construction, catch, fallback, implicit provide |
| Headless region (query, pool, policy) | `State` field on that entrypoint |
| Feature that paints | mounted `<Composer />` - never `new Composer()` on a parent |
| Mount-only ancestor (scroll pin, focus trap) | `Component` without `render()` |
| Chrome / token frame / zero-state strip | FC that `.get()`s |

`new X()` on a parent is for States and pool members. A nested `new Component()` that is not a pool member or hot-swap either paints - mount it - or is a State's job wearing paint. Don't wrap a consumer under a provider Component with nothing to paint; hold the State as a field on the controller that already exists and let sibling views `.get()` it.

**Anti-pattern - subcomponent overuse.** The sections in `render()` above are freestanding FCs, not PascalCase methods. Subcomponents (`<this.Header />`) are extension points for subclasses. Test: **would a subclass reasonably replace or wrap this renderer?** For ordinary scopes no - a freestanding FC calling `ReviewStep.get()` is clearer. See [component.md](component.md).

## 4. Give repeated UI entries their own class

A property or action *about* an entry in a collection lives on that entry's class - not the page. The tells are syntactic:

- a field keyed by id: `Record<Id, T>`, `Map<Id, unknown>`, or parallel structures - `items` plus `selectedIds`; a second pool of the members, `selected = has(Item)`, is the honest shape
- a method taking `(id, value)`: `setItemWeight(id, w)`, `toggle(id)`
- a page method re-finding a member by id `pool.get((x) => x.id === id)` - that is the member's method; behavior moves with state
- reassigning a collection to update one entry: `this.items = this.items.map(...)`, `this.jobs = { ...this.jobs, [id]: job }`

Each tell is a missing class. Declare a `has` pool - class mode when the seed matches the member's init, a factory only when it must transform - and move state and actions onto the member:

```tsx
// Wrong: item state flattened onto the page
class Inbox extends Component {
  messages: MessageDto[] = [];
  selectedIds = new Set<string>();
  uploads: Record<string, UploadJob> = {};

  setLabel(id: string, label: string) {
    this.messages = this.messages.map((m) => m.id === id ? { ...m, label } : m);
  }
}

// Right: the entry is a class; the page keeps fetch, the pool, and policy
class Message extends Component {
  id = set<string>();
  subject = '';
  label = '';
  selected = false;           // UI - not on the seed, never written by it
  inbox = get(Inbox);

  render() { /* the row paints itself */ }
}

class Inbox extends Component {
  messages = has(Message);    // add({ id, subject, label }) - the seed is the init

  get selected() {
    return this.messages.filter((m) => m.selected);
  }
}
```

Class mode writes only keys the class declares - leftover seed keys are skipped; a key on both with a clashing type is a TypeScript error, so check it, don't pre-empt it with a factory.

Selection flags, per-row status, row actions live on the member (`message.selected`, `message.archive()`); the page keeps fetch, pool lifecycle, multi-select *policy*. Rows owning `render()` place directly - `{inbox.messages}` or subset `{list}` - no `.map`. Two views computing the same expression over an entry -> a getter on the entry's class.

A row earns a pool with any one of: mutable UI state (selection, expanded), async lifecycle (upload, watch, progress), actions (remove, retry). Demoting it to a plain DTO is not economy: status reads thru lookups, and a method call on a raw instance creates no subscription - progress rendered only thru `page.importFor(id)` never repaints. Tracked reads reach the member thru the pool or its own `render()`.

A factory earns its line only when the seed must transform: fat payload folded to one field (`has((dto: MessageDto) => new Message({ info: dto, id: dto.id }))`), a rename, a colliding key dropped, multi-argument construction (`has((file: File) => new Attachment({ file }))`). Keep members small: promote a payload key to reactive field only when views render it or it changes independently; the rest stays whole as `info`. Normalize API `null` to `undefined` here so presence fields stay optional. See [has.md](../field/has.md) for pool surface, [patterns.md](patterns.md) for worked recipes.

Behavior parity does not exempt this step - parity constrains observable behavior, not code shape ("no redesigns" means UI and public contracts). Entry ownership is an invariant, not a style option.

## 5. Split regions out of fat orchestrators

When a page State still accumulates unrelated clusters after pools - draft fields, lookups, request state, navigation - each becomes its own State owned as a field. Ownership provides implicitly; views bind the region directly:

```tsx
class Composer extends State {        // headless region
  page = get(ComposePage);
  subject = '';
  attachments = has((file: File) => new Attachment({ file }));

  get ready() { ... }
}

class ComposePage extends Component { // orchestrator: route, session, request
  composer = new Composer();
  busy = false;

  get canSend() {
    return this.composer.ready && !this.busy;
  }

  async send() { /* composer -> request -> thread */ }
}

// Form sections bind the region; the footer mixes both
const { is: composer, subject } = Composer.get();
const { canSend, send } = ComposePage.get();
```

An owned region needs no cross-controller sync - the parent holds and reads the instance. Split when the second cluster appears, not as late cleanup.

A feature region is unpluggable: it owns its pool, display state, and chrome - don't leave the pool or query on the page because the page syncs it. Test each pane, strip, or panel the page mounts: delete its import - does the feature leave whole, pool included? Judge clusters by interaction, not product framing - clusters that never read each other are unrelated even when the product calls them one surface; a shared wire or replica decides sync, not view ownership. Sibling features read each other thru optional context (`get(Other, false)`); siblings don't see each other's context, so the consumer mounts beneath the provider in JSX. Extraction moves concerns off the class, not ownership off the tree: regions stay fields on the entrypoint. Only a shell owning nothing - chrome between entrypoint and features - demotes to an FC (step 3).

Same rule while building: a second concern appearing on a class is the moment it leaves. Bias one concern per State/Component; barrels are deliberate - the page after extraction, a pool owner, a shell that only mounts. Chrome counts: a resize handle's `height`/`resizing`/`beginDrag` parked on Composer fails like a stranded pool. Compose the add-on as a mounted wrapper - the sized thing reads the sizer:

```tsx
<Resize>                      {/* owns height, drag, the handle */}
  <div className="compose-box">
    <Draft />
  </div>
</Resize>

function Draft() {
  const { parts } = Composer.get();
  const { height } = Resize.get();  // the only other reader
  ...
}
```

Unplug is dropping the `<Resize>` wrap and the height read. `class Composer extends Resizable` is not this: extension puts drag fields on every `Composer.get()` snapshot. Extend for *is a kind of* (a `Nav` that is a `Link`); wrap for an add-on you take off.

## 6. Provide classes directly

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

Provide an instance only when preconfiguration or external ownership requires it. The app entrypoint needs neither: owned fields provide implicitly, so `main` mounts `<Inbox />` bare - a `Provider` plus `Session.new()` in bootstrap hides the construction graph.

## 7. Move source state and behavior; do not translate setters

Once ownership is settled:

- Values written by user input, browser events, timers, or network callbacks -> mutable class fields.
- `useMemo` values and effects that only sync state -> class getters.
- `useEffect` setup/teardown -> `protected new()` returning cleanup; browser-only resources -> `mount()` on a `Component`.
- Chains of `useEffect`s reacting to each other -> tracked reactions (`this.get($ => ...)`) registered in `new()`/`mount()`; updates batch, one re-run per flush however many trigger fields changed.
- `useCallback` handlers -> auto-bound class methods - pass directly to timers and listeners: `setInterval(this.tick, 1000)`, not `() => this.tick()`.
- `useRef` handles - unsubscribe functions, snapshots, timer ids -> unmanaged fields ([state.md](../state/state.md#unmanaged-instance-data)) - never reactive, never `#private`.
- Repeated `postMessage`-style calls over a typed union -> one signal helper (`signal('setLabel', { id })`). The union is the API - no per-message facade methods.
- Inbound host snapshots -> `this.set(values)` - unknown keys are ignored, missing keys stay; no `apply()`/`pick` facade ([set.md](../state/set.md)).
- Route params -> props on the page owner. Working identity (session, selection) is a separate field a reaction soft-syncs - never the URL param itself. Fusing them shows as stale-prop workarounds: fresh ids threaded thru arguments to outrun the route, shadow fields remembering the last route. Router recipe in [patterns.md](patterns.md).

```tsx
// Wrong: the URL param is the working identity - fresh ids outrun the route
class Workspace extends Component {
  sessionId?: string;                 // route prop

  async send() {
    let sid = this.sessionId;
    if (!sid) {
      sid = createId();               // threaded through locals; the model
      this.navigate(`/s/${sid}`);     // learns its own id via prop round-trip
    }
    await api.send(sid, this.body);
  }
}

// Right: the working field leads; navigation confirms, never informs
class Workspace extends Component {
  sessionId?: string;                 // working identity
  urlSessionId?: string;              // route prop

  mount() {
    return this.get(($) => {
      void $.urlSessionId;
      this.syncRoute();               // adopt or keep per policy - not 1:1
    });
  }

  async send() {
    const sid = this.sessionId ??= createId();
    this.navigate(`/s/${sid}`, { replace: true });
    await api.send(sid, this.body);
  }
}
```

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

Audit rule: **delete any method whose body is only `this.field = value`** - vocabulary without policy.

## 8. Getters: shared and semantic only

A derived value earns a getter on shared state when it has multiple consumers, domain or workflow meaning, cost enough to merit memoized tracking, a place in the state's deliberate API, or introspection value (debugging, devtools):

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

Judge meaning, not reference counts. A getter with one JSX consumer may still earn its place as a domain capability or introspectable surface - a locality finding needs a semantic argument ("this is JSX formatting, not workflow meaning"), never a count alone.

## 9. Kill prop drilling

Contextual children declare their own dependencies with `.get()` - drop the prop contracts the hooks needed:

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

`.get()` the nearest real parent. When Composer owns the form, its controls call `Composer.get()` - reaching over to `ComposePage.get()` and back down is drilling with extra steps. Facts repeated across those children (`status === 'sending'`) become parent getters (`get sending()`); nested config they keep unpacking is forwarded once (`get config() { return this.page.sendOptions; }`), named for the local scope - `config`, not `sendOptions`. Only the parent holds `get(ComposePage)`. The entrypoint is not exempt: token and frame chrome reads its own snapshot (`Frame` `.get()`s `theme`) - don't snapshot `this` at the root only to drill `style`.

## 10. Destructure an exact dependency snapshot

Every `.get()` / `.use()` opens the component with the exact reactive values it renders, nested levels included, optional objects defaulted in place. They are React hooks: top of component or `render()`, unconditionally - in a branch, handler, or loop they build green and crash at runtime.

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

Why:

1. A reviewer sees the complete dependency surface at the top.
2. Trapped getters are traversed once, not re-walked per expression.
3. Reads create subscriptions - a deep read in a branch subscribes only on renders where the branch runs (a **conditional subscription**); reads in event handlers never subscribe. The snapshot makes the surface deterministic.

Same for `this` in `Component.render()` and subcomponents - destructure at the top; rendering shares the hooks' subscription plumbing. Injected parents (`inbox = get(Inbox)`) are part of that snapshot - `Inbox.get()` in a render whose class already holds the field is a second subscription to the same instance. Static `.get()` is for freestanding FCs.

## 11. Write through the proxy; use `is` sparingly

Subscription proxies pass assignments through to the real instance. Three shapes cover every case:

```tsx
const transfer = TransferState.get();            // whole object is the only need

const { transfer, confirmed } = ReviewStep.get(); // nested object from a snapshot -
onClick={() => (transfer.step = 'generate')}      // writes are transparent

const { is: review, confirmed } = ReviewStep.get(); // root object + sibling values:
                                                     // only here does `is` earn its place
```

**Anti-pattern:** aliasing `is` whenever anything will be written. Writes don't need the raw instance - unwrapping nested objects through `is` is noise.

## 12. Widgets own their gates

Default: a self-contained widget mounts unconditionally and gates itself - the parent writes `<UndoBar />`; the bar reads `Outbox.get()` and falls thru when `pendingSend` is unset ([style.md](style.md) render fallthrough). A parent read existing only to gate belongs in the widget.

Parent gate plus child `get(true)` is the secondary shape - right when the parent reads the field for its own content, or composition genuinely varies. Either way presence is a contract; the half-measure fails audit - `get()` plus an internal null-guard mid-snapshot:

```tsx
// Wrong: no contract either way
function SettingsEditor() {
  const { draft, saving } = SettingsState.get();
  if (!draft) return null;
  ...
}

// Right (parent reads draft for its own content): parent gates, child asserts
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

## 13. Extract, then consolidate

A conditional JSX branch above ~10 lines or five component levels signals its own named scope - a heuristic, not a mandate. Then the inverse: **recombine scopes that share dependencies, read locally, and contain no nested decision logic.** Splitting every fragment adds navigation without clarifying ownership.

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

An early return skipping most of a declared snapshot signals the gated content wants its own component.

A `render()` past ~50 lines usually stopped composing. Conditionals and ternaries are the cut points when the branch is a widget - deleted or moved as a unit, with its own moving parts. Then `cond && <Widget />` becomes a local FC that `.get()`s the parent and owns the gate; `a ? <Foo /> : <Bar />` picks its branch inside. A one-op stays in the parent: a single gated button or formatted scalar is lines in `render()`, not a component - the extra name makes deleting or moving the feature touch two places. Look for a gated chunk, independent siblings sharing no snapshot, or a replaceable slice (that one a subcomponent). Not a hard fail - a dense one-concern tree stays; a hop just to get under 50 is worse than reading the paint in place.

A split needs a name meaningful without the parent (`UndoBar`, `AttachmentTray`). When the only honest name is parent plus "Body"/"Label" *and* the call site is children, it is not a concern. Two shapes stay valid even small: a child passed as a named slot prop (`label={<SenderBadge />}`, `detail`, `icon`) - the hop keeps the parent composing, not painting; and an early-return body whose branches *are* its job. A slot earns an FC only when it paints - `detail={String(unread || '')}` is a formatted scalar, inline.

A slot FC reads its own context: `UnreadBadge` calls `Folder.get()` and paints its pill instead of taking a prop unpacked from `this`, so the parent writes `detail={<UnreadBadge />}` without snapshotting for it. "Just presentation props" does not exempt a slot whose value came off `this` - the step 9 carve-out is for values with no contextual owner:

```tsx
// Wrong: parent snapshots files only to feed its own slot
render() {
  const { open, files } = this;
  return <Section open={open} detail={<SizeTally files={files} />} ... />;
}

// Right: the slot reads the parent; render() composes without it
function SizeTally() {
  const { files } = Outbox.get();
  ...
}
```

Same when section chrome wraps one Component - `open`/`onToggle` read from the parent by `.get()`, not drilled back thru a generic wrapper. A shared wrapper earns its props per caller: other callers varying does not license this one - a caller with constant slots gets its own chrome reading the parent.

Independent siblings that never interact (recipient field, attachment picker) split into local FCs in the same module, each snapshotting what it needs - independent *features* split; one-op chrome like a lone send button stays. A layout-only row with no state inlines into `render()`.

The line/depth threshold alone is never grounds for a finding. To fail a branch, name the concrete cost: a conditional subscription, multiple independent decisions in one branch, independent controls funneled thru one snapshot, mixed ownership, a duplicated dependency snapshot, or navigation a well-named scope would materially improve. "A separate component would be slightly nicer" is polish, not a defect.

## 14. Audit with this checklist

Classify every finding by severity:

- **Invariant** - fail unless a real constraint is documented.
- **Default** - follow unless the alternative has clearer ownership or API value.
- **Heuristic** - investigate, but never fail on the numerical signal alone; the finding must name a concrete cost.
- **Style** - apply by default per [style.md](style.md); report separately from architectural correctness.

The checklist:

- Is each state field owned at the narrowest useful scope? *(invariant)*
- Does state about a collection entry live on the entry's class - no id-keyed records, no `(id, value)` methods, no reassign-to-update-one-entry? *(invariant)*
- Is every `has((x) => new Foo({...}))` factory doing work `has(Foo)` wouldn't - transform, rename, multi-argument? *(default)*
- Are opaque handles (unsubscribe fns, timers, snapshots) unmanaged rather than reactive fields? *(invariant)*
- Does every subscription consume what it declares - no `void x` reads to force tracking in a render? *(invariant)*
- Does each class name one concern or a declared barrel (page orchestrator, pool owner, mounting shell) - unrelated clusters split into region States, each rendered feature unplugging by one import? *(default)*
- Does every Component earn its instance (owned fields, pool, boundary - not a ref plus a DOM-sync reaction) - pass-throughs demoted to FCs, stateless shells mounted not held? *(default)*
- Is the app/route entrypoint a Component owning replica and regions as fields - `main` only mounting it, no bootstrap `Provider`? *(default)*
- Is every `new Component()` on a parent a pool member or hot-swap - painting features mounted as JSX, regions held as State fields? *(invariant)*
- Does every Component without chrome omit `render()` - no `return this.props.children`? *(default)*
- Is working identity (session, selection) a separate field from URL params, soft-synced by a reaction? *(default)*
- Does every method do more than assign one field? *(invariant)*
- Are contextual values still being drilled through props - including slot FCs and section chrome fed values the parent unpacked from `this`? *(invariant)*
- Does every `.get()` / `.use()` show the exact nested dependency surface? *(invariant)*
- Are any reactive deep reads hidden in conditional branches or handlers? *(invariant)*
- Does a Component holding `foo = get(Foo)` read it thru `this` - never a second `Foo.get()` in `render()`? *(invariant)*
- Is `is` used only where the root object must be retained alongside sibling destructuring? *(invariant)*
- Is presence a contract - widget owns its gate and falls thru by default; parent gate + `.get(true)` where the parent reads the field for its own content; never `get()` plus an internal null-guard? *(invariant)*
- Are Component subcomponents genuine extension points? *(invariant)*
- Does every getter on shared state earn its place - multiple consumers, domain meaning, expensive computation, deliberate API, or introspection value? *(default - judge meaning, not reference counts)*
- Are large JSX branches and ~50-line renders split at conditionals into honestly-named scopes - units that delete or move as one place, never one-op conditionals or formatted scalars? *(heuristic - name the cost)*
- Are nested destructures placed after direct properties, with `is` first when retained? *(style)*
- Are modules near ~400 lines split at feature seams, without peeling thin wrappers? *(style)*

Auditing notes:

- Compare ownership, dependency surfaces, and write behavior - never filenames, file counts, or similarity to a reference implementation. File size and consolidation follow [style.md](style.md) layout unless the project overrides - style lane, scored separately.
- Report two verdicts - architectural conformance and style adherence - so a formatting miss cannot obscure correct structure, or vice versa.
- Deliver the filled checklist with the change (PR description or ledger), not only a verdict.
