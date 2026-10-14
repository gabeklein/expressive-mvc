export interface ToolCall {
  id: string;
  name: string;
  input: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  calls?: ToolCall[];
}

export const user = (content: string): Message => ({ role: 'user', content });

export const result = (call: ToolCall, content: string): Message => ({ role: 'tool', content: `${call.id}: ${content}` });

export const toolCalls = (message: Message) => message.calls || [];

export const safe = (call: ToolCall) => call.name == 'read';

export const MINUTE = 60_000;

export const delay = (ms: number, { signal }: { signal: AbortSignal }) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

export const model = {
  async create(messages: Iterable<Message>): Promise<Message> {
    const list = [...messages];
    const last = list[list.length - 1];

    if (last.role == 'tool') return { role: 'assistant', content: 'done' };

    const calls = last.content.split(', ').map((task, index) => {
      const [name, input] = task.split(' ');

      return { id: `call_${list.length}_${index}`, name, input };
    });

    return { role: 'assistant', content: '', calls };
  }
};

export const tools = {
  async run(call: ToolCall): Promise<string> {
    return `${call.name} ${call.input} ok`;
  }
};
