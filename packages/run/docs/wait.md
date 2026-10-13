# Wait - Park Until Answered

`this.then.wait(context?)` in a step issues a token which, when its turn comes in the plan, parks its branch. Status is `waiting` while any wait is open; `then.waiting` lists open waits as `{ id, context }`, oldest first, reactive.

```ts
protected async tool(call: ToolCall) {
  let allowed = this.mode === 'yolo';

  if (allowed || this.mode === 'auto' && safe(call)) this.exec(call);
  else this.then.wait(call);
}

async allow(call: ToolCall) {
  this.exec(call);
}

async deny(call: ToolCall) {
  this.messages.push(result(call, 'denied'));
}
```

While a wait is open, an outside call to any step but `next` and `end` answers the oldest one. It runs as a step at once - journaled with `wake: 'wait#1'` - and what it schedules takes the wait's place; once that completes, the plan continues after the wait. The call itself returns nothing; the run's Promise carries the outcome.

```ts
const reply = agent.next('write notes');

agent.then.waiting;                    // [{ id: 'wait#1', context: { name: 'write', … } }]
agent.allow(agent.then.waiting[0].context as ToolCall);

await reply;
```

`next` from outside still queues a run, never answers a wait. Two waits in a group are answered in the order they parked.

A wait reached while undo closures are held logs `console.warn` once per run - closures will not survive a resume in the job tier; return a token as the undo instead ([undo.md](undo.md)).

`stop()` releases open waits. Outside a step, `then.wait()` throws `wait must be called inside a step.`
