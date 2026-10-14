import { has } from '@expressive/mvc';
import { Job } from '@expressive/run';

import { model, result, safe, toolCalls, tools, user, type Message, type ToolCall } from './services';

export class Agent extends Job {
  mode: 'ask' | 'auto' | 'yolo' = 'ask';
  messages = has<Message>();

  async next(prompt: string) {
    this.messages.push(user(prompt));
    this.turn();
  }

  protected async turn() {
    const reply = await model.create(this.messages);

    this.messages.push(reply);

    const calls = toolCalls(reply);

    if (calls.length) {
      this.then(calls, this.tool);
      this.turn();
    }
    else this.end(reply);
  }

  protected async tool(call: ToolCall) {
    let allowed = this.mode === 'yolo';

    if (allowed || this.mode === 'auto' && safe(call)) this.exec(call);
    else this.then(this.allow, this.deny);
  }

  protected async exec(call: ToolCall) {
    this.then.retry({ attempts: 2 });
    this.messages.push(result(call, await tools.run(call)));
  }

  async allow(call: ToolCall) {
    this.exec(call);
  }

  async deny(call: ToolCall) {
    this.messages.push(result(call, 'denied'));
  }

  protected end(reply: Message) {
    return reply.content;
  }
}
