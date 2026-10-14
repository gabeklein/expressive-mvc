# Wait - Park Until Answered

`this.then(...steps)` in a step, each argument a step of this instance, parks that point in the plan as a wait. Any one of the listed steps answers it - called from outside, or by a [watcher](#watchers); their order carries no meaning. It is sequenced like any other item: what the step schedules after it runs once the answer, and everything the answer schedules, has completed.

```ts
protected async tool(call: ToolCall) {
  let allowed = this.mode === 'yolo';

  if (allowed || this.mode === 'auto' && safe(call)) this.exec(call);
  else this.then(this.allow, this.deny);
}

async allow(call: ToolCall) {
  this.exec(call);
}

async deny(call: ToolCall) {
  this.messages.push(result(call, 'denied'));
}
```

Status is `waiting` while any wait is open. `then.waiting` lists open waits, oldest first, reactive - `step` and `args` are those of the step which opened it, `answers` the steps accepted:

```ts
agent.then.waiting;   // [{ id: 'wait#1', step: 'tool', args: [call, 0], answers: ['allow', 'deny'] }]
```

Journal: the opening step's `next` holds `{ id: 'wait#1', key: 'wait', args: [], answers: ['allow', 'deny'] }`; the answer's entry carries `wake: 'wait#1'`.

## Answering steps

Every step but `next` reads `undefined` from outside, unless an open wait in the current run accepts it - then it reads the callable step. The read tracks: a `get()` effect or a render updates as it appears and disappears. Inside a step, every step is callable as usual - `this.allow(call)` schedules it. The declared type stays non-optional.

```tsx
const Approve = ({ call }: { call: ToolCall }) => {
  const agent = Agent.get();

  return agent.allow && <button onClick={() => agent.allow(call)}>Allow</button>;
};
```

A bare `if (agent.allow)` with no call to it inside trips TS2774 - the type says it is always defined.

Called from outside, an answering step answers one wait: the one whose opening step's first argument is `===` its own first argument, else the oldest accepting it. It runs in that wait's place, the wait closes, and presence updates for every step it accepted. Its call returns a Promise which resolves (`undefined`) once that step and everything it scheduled have completed - not the whole run - and rejects with the run's error if the run fails or stops first. Awaiting it counts as awaiting the run for [unawaited failures](runs.md#unawaited-failures).

```ts
const reply = agent.next('write notes, write docs');
const [notes, docs] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

await agent.allow(docs);              // docs' tool has run; notes still waits
await agent.deny(notes);
await reply;
```

Nothing is buffered. A step called from outside with no open wait accepting it - a held reference after its wait closed, say - throws `allow cannot be called from outside; call next() to run.`

A call through the proxy of a settled step - a timer or arrow inside the step that opened the wait - is an outside call too, with two scopes: it answers that step's own open wait first, so parallel waits on the same steps each take their own answer without the routing argument; and it is bound to its run - once that run ends, it throws (`tool has settled; deny cannot run.`), so a timer left behind cannot answer the next run's wait.

## Watchers

A plain function among a wait's arguments - not a step - is a watcher. It starts when the plan reaches the wait, so a timeout counts from when waiting begins, and receives an `AbortSignal`. It answers by calling an accepted step - in an arrow, `this` is the step that opened the wait, so the call answers that wait first.

```ts
protected async tool(call: ToolCall) {
  let allowed = this.mode === 'yolo';

  if (allowed || this.mode === 'auto' && safe(call)) this.exec(call);
  else
    this.then(this.allow, this.deny, async (signal) => {
      await delay(MINUTE, { signal });
      this.deny(call);
    });
}
```

- The wait closes on its first answer - an outside call or a watcher's. Then every watcher's signal aborts; a watcher's later call throws as any stale call does.
- A watcher that settles without answering leaves the wait open - a nudge (`await delay(DAY, { signal }); alerts.notify(…)`), not a decision. A repeating nudge loops on `!signal.aborted`.
- A watcher that throws before the wait closes fails the run. What a watcher throws after its wait closed is discarded.
- `end`, `stop` and a failure close every open wait and abort its watchers.
- Writes in a watcher are unmanaged, like a `_` helper's - in no `patch`, not rolled back. The watcher waits and decides; the answer acts.
- A `function` watcher is called with the opening step's proxy as `this`, as an arrow sees it.
- Watchers are in-process: a timer dies with the process and is not journaled.
- Tokens mixed with step references fail the run: `then() takes called steps or step references, not both.`

## Rules

- `next` and `end` cannot answer a wait - listing one fails the run (`end cannot answer a wait.`).
- A wait returned from a step is not in the plan: it parks the unwind on failure ([undo.md](undo.md#a-returned-wait)).
- A wait reached while undo closures are held logs `console.warn` once per run - closures will not survive a resume in the job tier; return a token as the undo instead ([undo.md](undo.md)).
- `stop()`, a failure, and `then.end()` from outside release open waits and abort their watchers.
