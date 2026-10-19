import { has } from '@expressive/mvc';
import { Job } from '@expressive/run';

import { delay, MINUTE, model, result, safe, toolCalls, tools, user, type Message, type ToolCall } from './services';

// light journal (no rewind): a long-lived instance whose fields are the product - a failed turn keeps what earlier steps committed
export class Agent extends Job {
  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages = has<Message>();
  draft = has<string>();
  steers = has<string>();

  // one run per prompt; fields persist across runs, and a prompt sent mid-run queues
  async next(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }

  protected async turn() {
    const reply = await model.create(this.messages, {
      // stop() aborts the model call through the step's own signal
      signal: this.then.signal,
      onChunk: (chunk) => this.draft.push(chunk)
    });

    const calls = toolCalls(reply);
    let calling = calls.length > 0;

    // the mailbox is pulled once the model stops calling tools, so each tool result follows its call
    const steers = calling ? [] : this.steers.pop(0, this.steers.size);

    this.draft.clear();
    this.messages.push(reply, ...steers.map(user));

    if (calling) {
      this.then(calls, this.tool);      // a mapped group: tool(call, index) per call, in parallel
      this.turn();                      // the loop - runs once every tool is done
    }
    else if (steers.length) {
      this.turn();
    }
    else {
      this.end(reply);
    }
  }

  protected async tool(call: ToolCall) {
    // mode is read when the step runs, so writing it from outside steers later calls
    let allowed = this.mode === 'yolo';

    // else park until allow or deny answers - the watcher denies after a minute
    // a throw from exec runs it once more in its place - its own pushes undone first, so nothing repeats
    if (allowed || this.mode === 'auto' && safe(call))
      this.exec(call).catch(this.exec);
    else
      this.then(this.allow, this.deny, async (signal) => {
        await delay(MINUTE, { signal });
        this.deny(call);
      });
  }

  protected async exec(call: ToolCall) {
    this.messages.push(result(call, await tools.run(call)));
  }

  // answering steps: public, and defined on the instance only while a wait accepts them
  async allow(call: ToolCall) {
    this.exec(call).catch(this.exec);
  }

  async deny(call: ToolCall) {
    this.messages.push(result(call, 'denied'));
  }

  protected end(reply: Message) {
    return reply.content;
  }
}
