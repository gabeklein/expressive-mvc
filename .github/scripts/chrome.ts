export const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export class Browser {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, (value: any) => void>();
  private proc!: ReturnType<typeof Bun.spawn>;
  errors: string[] = [];
  warnings: string[] = [];

  async open(url: string, profile: string) {
    const targets = await this.launch(profile).catch(() => this.launch(profile));

    this.ws = new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((ready) => (this.ws.onopen = ready));
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) this.pending.get(message.id)?.(message);
      else if (message.method == 'Runtime.consoleAPICalled' && message.params.type == 'warning')
        this.warnings.push(message.params.args.map((arg: any) => arg.value ?? arg.description).join(' '));
      else if (message.method == 'Runtime.consoleAPICalled' && message.params.type == 'error')
        this.errors.push(message.params.args.map((arg: any) => arg.value ?? arg.description).join(' '));
      else if (message.method == 'Runtime.exceptionThrown')
        this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    };

    await this.send('Runtime.enable');
    await this.send('Page.navigate', { url });
  }

  private async launch(profile: string) {
    const port = 9300 + Math.floor(Math.random() * 500);

    this.proc = Bun.spawn([
      CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`, 'about:blank'
    ], { stdout: 'ignore', stderr: 'ignore' });

    try {
      return await until(async () => {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        return list.find((target: any) => target.type == 'page');
      }, 15000);
    } catch (error) {
      this.proc.kill();
      await this.proc.exited;
      throw error;
    }
  }

  send(method: string, params = {}) {
    return new Promise<any>((done) => {
      const id = ++this.id;
      this.pending.set(id, done);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string) {
    const reply = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return reply.result?.result?.value;
  }

  text(selector: string) {
    return this.eval(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
  }

  color(selector: string) {
    return this.eval(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); return node && getComputedStyle(node).color; })()`);
  }

  async close() {
    this.ws?.close();
    this.proc?.kill();
    await this.proc?.exited;
  }
}

export async function until<T>(check: () => Promise<T | undefined | false | null>, timeout = 6000): Promise<T> {
  const end = Date.now() + timeout;
  let last: unknown;

  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value as T;
    } catch (error) {
      last = error;
    }
    await Bun.sleep(100);
  }

  throw new Error(`timed out${last ? `: ${last}` : ''}`);
}
