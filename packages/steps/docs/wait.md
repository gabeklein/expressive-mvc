# Wait - Park Until Answered

`this.then(...steps)` in a step, each argument a step of this instance uncalled, parks that point in the plan as a wait. Any one of the listed steps answers it - called from outside, or by a [racer](#racers); their order carries no meaning. It is sequenced like any other item: what the step schedules after it runs once the answer, and everything the answer schedules, has completed.

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

Journal: the opening step's `run` holds `{ id: 'wait#1', key: 'wait', args: [], answers: ['allow', 'deny'] }`; the answer's entry carries `wake: 'wait#1'`.

## Answering steps

Every step but `run` reads `undefined` from outside, unless an open wait in the current run accepts it - then it reads the callable step. The read tracks: a `get()` effect or a render updates as it appears and disappears. Inside a step, every step is callable as usual - `this.allow(call)` schedules it. The declared type stays non-optional.

```tsx
const Approve = ({ call }: { call: ToolCall }) => {
  const agent = Agent.get();

  return agent.allow && <button onClick={() => agent.allow(call)}>Allow</button>;
};
```

A bare `if (agent.allow)` with no call to it inside trips TS2774 - the type says it is always defined.

Called from outside, an answering step answers one wait: the one whose opening step's first argument is `===` its own first argument, else the oldest accepting it. It runs in that wait's place, the wait closes, and presence updates for every step it accepted. Its call returns a Promise which resolves (`undefined`) once that step and everything it scheduled have completed - not the whole run - and rejects with the run's error if the run fails or stops first. Awaiting it counts as awaiting the run for [unawaited failures](runs.md#unawaited-failures). Left unawaited, its rejection is not reported on its own - the run reports the failure.

```ts
const reply = agent.run('write notes, write docs');
const [notes, docs] = agent.then.waiting.filter((wait) => wait.step == 'tool').map((wait) => wait.args[0] as ToolCall);

await agent.allow(docs);              // docs' tool has run; notes still waits
await agent.deny(notes);
await reply;
```

Nothing is buffered. A step called from outside with no open wait accepting it - a held reference after its wait closed, say - throws `allow cannot be called from outside; call run() to start a run.`

A call through the proxy of a settled step - a timer or arrow left by the step that opened the wait - is an outside call too, with two scopes: it answers that step's own open wait first, so parallel waits on the same steps each take their own answer without the routing argument; and it is bound to its run - once that run ends, it throws (`tool has settled; deny cannot run.`), so a timer left behind cannot answer the next run's wait.

## Racers

A step called among a wait's arguments - `this.timeout(call)` - is a racer. It is claimed, not scheduled in sequence, and starts when the plan reaches the wait, so a timeout counts from when waiting begins. It answers by calling an accepted step: inside a racer, a call to one of the wait's answers - scheduled by the racer or by anything below it - answers that wait instead of running as a child.

```ts
protected async tool(call: ToolCall) {
  let allowed = this.mode === 'yolo';

  if (allowed || this.mode === 'auto' && safe(call))
    this.exec(call);
  else
    this.then(this.allow, this.deny, this.timeout(call));
}

protected async timeout(call: ToolCall) {
  this.then({ min: 1 });
  this.deny(call);
}
```

- The wait closes on its first answer - an outside call or a racer's. The racer whose branch answered wins and keeps all it did. The others lose: signals abort, what they have yet to run is dropped, open waits and gates below them release; a step in flight settles first. Then each losing branch unwinds as a [caught failure](catch.md) does - its undos run newest first, given a `'Stopped'` error (`deny answered wait#1.`), and the fields it wrote are restored. Effects without an undo stay.
- A racer that settles without answering leaves the wait open - a nudge (`this.then({ day: 1 }); this.notify();`), not a decision.
- A racer that throws fails the run, or the `.catch` around the wait.
- `end`, `stop`, `abort` and a failure close every open wait and abort its racers.
- Racers are journaled steps: the wait's token holds them as `race` - one step, or a group of several - and a [replay](catch.md#retry) of the wait races them again.
- `then.waiting` lists a racer's own waits too - a duration as `{ step: 'timeout', answers: [], until }`.
- A racer must be a step called by the same step - else `then() races steps called for it - this.then(this.allow, this.timeout(call)).` Another function among the answers throws `then() takes steps uncalled to answer and called ones to race - not other functions.`

## Durations

`this.then({ ms, sec, min, hr, day })` - a plain object, units summed - parks that point in the plan for a time: a wait nothing answers. What the step schedules after it runs once it passes.

```ts
protected async test() {
  if (this.then.retried) this.then({ sec: 2 ** this.then.retried });   // backoff before the replay
  this.suite();
}
```

- Status is `waiting`; `then.waiting` lists it with `until` - when it closes, epoch milliseconds.
- Journaled as `{ id: 'wait#1', key: 'wait', args: [1500], answers: [] }` - `args` holds the milliseconds.
- An unknown unit or a value not a non-negative number throws `then() takes a duration of ms, sec, min, hr and day as numbers - got secs.`; a duration beside steps, `then() takes a duration alone - this.then({ sec: 10 }).`
- `end`, `stop`, `abort`, a failure, a caught failure in its branch and a lost race clear its timer.

## Rules

- `run` cannot answer a wait - listing it fails the run (`run cannot answer a wait.`).
- A wait reached while function undos are held logs `console.warn` once per run - closures will not survive a resume in the durable tier; register a step instead ([undo.md](undo.md#undos)).
- `stop()`, `abort()`, a failure, and `then.end()` from outside release open waits and abort their racers.
