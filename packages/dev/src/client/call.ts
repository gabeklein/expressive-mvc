import type { Context as Contexts, State, def as instruction } from "@expressive/mvc";

interface Routed extends State {
  base: string;
  to: string;
  router: { segment(to: string): string };
}

interface Definition {
  name: string;
  fields: string[];
  methods: Record<string, string>;
  children?: Record<string, Definition>;
}

interface Meta {
  id: string;
  name: string;
  pattern: string[];
  pool?: string;
  path?: string;
}

interface Shape {
  fields: string[];
  children?: Record<string, Definition>;
}

type Patch = { patch: Record<string, unknown>; version: string };

export function runtime(Base: typeof State, def: typeof instruction, Context: typeof Contexts, Route: State.Type<Routed>) {
  const classes = new Map<string, ErrorConstructor>();
  const versions = new WeakMap<State, string>();
  const waiting = new WeakMap<State, Map<string, State.Apply>>();
  const meta = new WeakMap<State, Meta>();
  const shapes = new WeakMap<State, Shape>();
  const kids = new WeakMap<State, Map<string, { generation: string; child: State }>>();
  const roots = new WeakMap<State, State>();
  const made = new WeakMap<Definition, State.Type>();
  const attaching = new WeakMap<State, Promise<void>>();
  const early = new WeakMap<State, Map<string, Patch>>();
  const dropped = new WeakSet<State>();
  const twins = new Map<string, WeakRef<State>>();
  const released = new Set<string>();
  const lost = new FinalizationRegistry<string>(id => {
    twins.delete(id);
    released.add(id);
  });
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
    on("stale", stale => Object.keys(stale).forEach(key => {
      const twin = twins.get(key.split(".")[0])?.deref();
      if (twin) refresh(twin);
    }));
    on("beat", ({ sum }) => sum !== checksum() && held().forEach(refresh));
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

    for (const twin of held()) {
      const { id } = meta.get(twin)!;
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

  function apply(frame: Record<string, Patch>, ready?: State): void {
    for (const key of Object.keys(frame).sort()) {
      const [id, ...path] = key.split(".");
      const twin = twins.get(id)?.deref();
      const { patch, version } = frame[key];

      if (!twin) continue;

      if (twin !== ready && !versions.has(twin)) {
        const held = early.get(twin) ?? new Map<string, Patch>();
        const prior = held.get(key);

        held.set(key, { patch: { ...prior?.patch, ...patch }, version });
        early.set(twin, held);
        continue;
      }

      const held = path.reduce<{ child: State; generation?: string } | undefined>((at, field) => at && kids.get(at.child)?.get(field), { child: twin });
      const generation = version.split(":")[0];

      if (held && (held.generation ?? generation) === generation) sync(held.child, patch, version);
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

      waiting.get(twin)!.set(key, config);

      return config;
    });
  }

  function sync(twin: State, values: Record<string, unknown>, version: string): void {
    const [generation, counter] = version.split(":");
    const [held, at] = versions.get(twin)?.split(":") ?? [];
    const whole = held !== generation;

    if (!whole && Number(counter) < Number(at)) return;

    const { fields, children } = shapes.get(twin)!;

    if (whole) values = Object.fromEntries(fields.map(field => [field, values[field]]));

    values = Object.fromEntries(Object.entries(values).filter(([, value]) => !isPending(value)));

    if (children) values = nest(twin, values, children);

    versions.set(twin, version);
    syncing = true;

    try {
      twin.set(values);
    } finally {
      syncing = false;
    }

    const unset = waiting.get(twin)!;

    for (const field of Object.keys(values)) {
      const config = unset.get(field);

      if (!config) continue;

      config.get = false;
      unset.delete(field);
    }
  }

  function isPending(value: unknown): boolean {
    return (value as { $pending?: unknown } | null)?.$pending === true;
  }

  function since(twin: State): Record<string, string> {
    const version = versions.get(twin);
    return version ? { "if-none-match": version } : {};
  }

  async function attach(twin: State): Promise<void> {
    const { id, pool } = meta.get(twin)!;
    const reply = await send(where(twin), { "x-expressive-get": pool ?? "default", "x-expressive-twin": id, ...since(twin) }, []);

    if (dropped.has(twin)) return void released.add(id);
    if (reply) apply(reply.frame, twin);

    const pending = early.get(twin);

    if (pending) {
      early.delete(twin);
      apply(Object.fromEntries(pending));
    }
  }

  function nest(owner: State, values: Record<string, unknown>, children: Record<string, Definition>): Record<string, unknown> {
    const held = kids.get(owner) ?? new Map<string, { generation: string; child: State }>();
    const out = { ...values };

    kids.set(owner, held);

    for (const field of Object.keys(children)) {
      if (!(field in values)) continue;

      const marker = values[field] as { $child: string } | null;

      if (!marker) {
        held.delete(field);
        out[field] = undefined;
        continue;
      }

      const current = held.get(field);

      if (current?.generation !== marker.$child)
        held.set(field, { generation: marker.$child, child: new (classOf(children[field]) as any)(roots.get(owner) ?? owner) });

      out[field] = held.get(field)!.child;
    }

    return out;
  }

  function classOf(definition: Definition): State.Type {
    let Child = made.get(definition);

    if (Child) return Child;

    const named = {
      [definition.name]: class extends Base {
        constructor(root: State) {
          super();

          waiting.set(this, new Map());
          shapes.set(this, definition);
          roots.set(this, root);

          for (const field of definition.fields) (this as any)[field] = served();
        }
      },
    };

    Child = named[definition.name] as unknown as State.Type;
    made.set(definition, Child);
    methods(Child, definition.methods);

    return Child;
  }

  function methods(Type: State.Type, ids: Record<string, string>): void {
    for (const [method, id] of Object.entries(ids))
      Object.defineProperty(Type.prototype, method, {
        configurable: true,
        writable: true,
        value(this: State, ...args: unknown[]) {
          return invoke(roots.get(this) ?? this, id, args);
        },
      });
  }

  async function rejoin(): Promise<void> {
    await Promise.all(held().map(attach));
  }

  function leave(twin: State): void {
    const { id } = meta.get(twin)!;

    dropped.add(twin);
    lost.unregister(twin);
    twins.delete(id);
    released.add(id);
  }

  async function invoke(twin: State, name: string, args: unknown[]): Promise<unknown> {
    await attaching.get(twin);

    const { id } = meta.get(twin)!;
    const reply = await send(where(twin, name), { "x-expressive-call": name, "x-expressive-twin": id, ...since(twin) }, args);

    apply(reply.frame);

    return reply.value;
  }

  function held(): State[] {
    return [...twins.values()].map(ref => ref.deref()).filter(twin => twin !== undefined);
  }

  function where(twin: State, name = "default"): string {
    const { pattern, pool, path } = meta.get(twin)!;
    return pool ? path! : pathOf(pattern, name);
  }

  function place(twin: State): void {
    const info = meta.get(twin)!;
    const route = Context.get(twin).get(Route, false);

    info.path = route ? pathOf(split(route.base + route.router.segment(route.to)), info.name) : "/.expressive/detached";
  }

  function split(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  function twin(pattern: string[], ids: Record<string, string>, fields: string[], name: string, pool?: string, children?: Record<string, Definition>): State.Type {
    const named = {
      [name]: class extends Base {
        constructor(...args: any[]) {
          super(...args);

          const id = `${name}-${uid()}`;

          waiting.set(this, new Map());
          meta.set(this, { id, name, pattern, pool });
          shapes.set(this, { fields, children });
          twins.set(id, new WeakRef(this));
          lost.register(this, id, this);
          listen();

          for (const field of fields) (this as any)[field] = served();

          this.set(null, () => leave(this));
          attaching.set(this, pool ? Promise.resolve().then(() => (place(this), attach(this))) : attach(this));
        }
      },
    };
    const Twin = named[name];

    methods(Twin, ids);

    return Twin;
  }

  return { call, define, twin };
}
