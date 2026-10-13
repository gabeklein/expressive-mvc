# Wait - Park Until Answered

`this.then(...steps)` in a step, every argument a step of this instance, parks that point in the plan as a wait. Any one of the listed steps answers it, called from outside; their order carries no meaning. It is sequenced like any other item: what the step schedules after it runs once the answer, and everything the answer schedules, has completed.

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

## Rules

- `next` and `end` cannot answer a wait - listing one fails the run (`end cannot answer a wait.`).
- A wait token returned from a step fails the run as any other value would.
- A wait reached while undo closures are held logs `console.warn` once per run - closures will not survive a resume in the job tier; return a token as the undo instead ([undo.md](undo.md)).
- `stop()`, a failure, and `then.end()` from outside release open waits.
