import type { State, def as instruction } from "@expressive/mvc";

export function runtime(Base: typeof State, def: typeof instruction) {
  const classes = new Map<string, ErrorConstructor>();
  const versions = new WeakMap<State, string>();
  const pending = new WeakMap<State, State.Apply[]>();
  const meta = new WeakMap<State, { id: string; pattern: string[]; fields: string[] }>();
  const attaching = new WeakMap<State, Promise<void>>();
  const early = new WeakMap<State, { patch: Record<string, unknown>; version: string }>();
  const dropped = new WeakSet<State>();
  const twins = new Map<string, State>();
  const released = new Set<string>();
  const refreshing = new WeakMap<State, Promise<void>>();
  const again = new WeakSet<State>();
  const connection = crypto.randomUUID();
  let source: EventSource | undefined;
  let epoch: string | undefined;
  let syncing = false;

  function uid(): string {
    return (0.278 + Math.random() * 0.722).toString(36).substring(2, 8).toUpperCase();
  }

  function define(id: string, name: string): ErrorConstructor {
    // a computed key gives the anonymous class its name
    const named = { [name]: class extends Error {} };
    const Type = named[name] as ErrorConstructor;

    Type.prototype.name = name;
    classes.set(id, Type);

    return Type;
  }

  function pathOf(pattern: string[], name: string): string {
    const at = location.pathname.split("/").filter(Boolean);
    const path = pattern.map((part, i) => {
      if (part === "*") return at.slice(i).join("/");

      const matches = at[i] !== undefined && (part.startsWith(":") || part === at[i]);

      if (!matches)
        throw new Error(`${name}() belongs to /${pattern.join("/")} and cannot be called from ${location.pathname}.`);

      return at[i];
    });

    return "/" + path.join("/");
  }

  async function send(path: string, headers: Record<string, string>, body: unknown): Promise<any> {
    const release: Record<string, string> = released.size ? { "x-expressive-release": [...released].join(",") } : {};
    released.clear();

    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-expressive-connection": connection, ...release, ...headers },
      body: JSON.stringify(body),
    });

    const next = res.headers.get("x-expressive-epoch");

    if (next && adopt(next)) await rejoin();

    return settle(res);
  }

  function adopt(next: string): boolean {
    const reset = !!epoch && next !== epoch;

    epoch = next;

    return reset;
  }

  function listen(): void {
    if (source) return;

    const on = (event: string, handle: (data: any) => void) =>
      source!.addEventListener(event, message => handle(JSON.parse((message as MessageEvent).data)));

    source = new EventSource(`/.expressive/stream?connection=${connection}`);

    on("hello", ({ epoch }) => adopt(epoch) && rejoin());
    on("stale", stale => Object.keys(stale).forEach(id => twins.has(id) && refresh(twins.get(id)!)));
    on("beat", ({ sum }) => sum !== checksum() && twins.forEach(refresh));
  }

  function refresh(twin: State): void {
    if (refreshing.has(twin)) return void again.add(twin);

    const done = attach(twin)
      .catch(() => {})
      .then(() => {
        refreshing.delete(twin);
        if (again.delete(twin)) refresh(twin);
      });

    refreshing.set(twin, done);
  }

  function checksum(): number {
    let sum = 0;

    for (const [id, twin] of twins) {
      const version = versions.get(twin);
      if (version) sum = (sum ^ fnv(`${id}@${version}`)) >>> 0;
    }

    return sum;
  }

  function fnv(text: string): number {
    let hash = 0x811c9dc5;

    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);

    return hash >>> 0;
  }

  async function settle(res: Response): Promise<any> {
    if (res.status === 304) return;

    const body = await res.json();

    if (res.ok) return body;

    const { error, message, stack, ...fields } = body;
    const Type = classes.get(error) ?? Error;

    throw Object.assign(new Type(message), fields);
  }

  function apply(frame: Record<string, { patch: Record<string, unknown>; version: string }>): void {
    for (const [id, { patch, version }] of Object.entries(frame)) {
      const twin = twins.get(id);

      if (!twin) continue;
      if (versions.has(twin)) sync(twin, patch, version);
      else early.set(twin, { patch: { ...early.get(twin)?.patch, ...patch }, version });
    }
  }

  async function call(pattern: string[], name: string, args: unknown[]): Promise<unknown> {
    const reply = await send(pathOf(pattern, name), { "x-expressive-call": name }, args);

    apply(reply.frame);

    return reply.value;
  }

  function served(): unknown {
    return def((key, twin) => {
      const config: State.Apply = {
        get: true,
        set() {
          if (!syncing) throw new Error(`${twin}.${key} is read-only - change it through a method.`);
        },
      };

      pending.get(twin)!.push(config);

      return config;
    });
  }

  function sync(twin: State, values: Record<string, unknown>, version: string): void {
    const [generation, counter] = version.split(":");
    const [held, at] = versions.get(twin)?.split(":") ?? [];
    const configs = held === generation ? undefined : pending.get(twin);

    if (!configs && Number(counter) < Number(at)) return;
    if (configs) values = Object.fromEntries(meta.get(twin)!.fields.map(field => [field, values[field]]));

    versions.set(twin, version);
    syncing = true;

    try {
      twin.set(values);
    } finally {
      syncing = false;
    }

    configs?.splice(0).forEach(config => (config.get = false));
  }

  function since(twin: State): Record<string, string> {
    const version = versions.get(twin);
    return version ? { "if-none-match": version } : {};
  }

  async function attach(twin: State): Promise<void> {
    const { id, pattern } = meta.get(twin)!;
    const reply = await send(pathOf(pattern, "default"), { "x-expressive-get": "default", "x-expressive-twin": id, ...since(twin) }, []);

    if (dropped.has(twin)) return void released.add(id);
    if (reply) sync(twin, reply.values, reply.version);

    const pending = early.get(twin);

    if (pending) {
      early.delete(twin);
      sync(twin, pending.patch, pending.version);
    }
  }

  async function rejoin(): Promise<void> {
    await Promise.all([...twins.values()].map(attach));
  }

  function leave(twin: State): void {
    const { id } = meta.get(twin)!;

    dropped.add(twin);
    twins.delete(id);
    released.add(id);
  }

  async function invoke(twin: State, name: string, args: unknown[]): Promise<unknown> {
    await attaching.get(twin);

    const { id, pattern } = meta.get(twin)!;
    const reply = await send(pathOf(pattern, name), { "x-expressive-call": name, "x-expressive-twin": id, ...since(twin) }, args);

    apply(reply.frame);

    return reply.value;
  }

  function twin(pattern: string[], methods: Record<string, string>, fields: string[], name: string): State.Type {
    const named = {
      [name]: class extends Base {
        constructor(...args: any[]) {
          super(...args);

          const id = `${name}-${uid()}`;

          pending.set(this, []);
          meta.set(this, { id, pattern, fields });
          twins.set(id, this);
          listen();

          for (const field of fields) (this as any)[field] = served();

          this.set(null, () => leave(this));
          attaching.set(this, attach(this));
        }
      },
    };
    const Twin = named[name];

    for (const [method, id] of Object.entries(methods))
      Object.defineProperty(Twin.prototype, method, {
        configurable: true,
        writable: true,
        value(this: State, ...args: unknown[]) {
          return invoke(this, id, args);
        },
      });

    return Twin;
  }

  return { call, define, twin };
}
