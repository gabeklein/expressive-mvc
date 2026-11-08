import type { Context as Contexts, Model, def as instruction } from "@expressive/mvc";

import type { client as Client } from "./call";

interface Routed extends Model {
  base: string;
  to: string;
  router: { path: string; segment(to: string): string };
}

interface Definition {
  name: string;
  fields: string[];
  methods: Record<string, string>;
  children?: Record<string, Definition>;
}

interface Shape {
  fields: string[];
  children?: Record<string, Definition>;
}

type Patch = { patch: Record<string, unknown>; version: string };

interface Entry {
  root: Model;
  shape: Shape;
  pending: Set<string>;
  kids: Map<string, { generation: string; child: Model }>;
  version?: string;
}

interface Root extends Entry {
  id: string;
  name: string;
  pattern: string[];
  pool?: string;
  path?: string;
  attaching?: Promise<void>;
  early?: Map<string, Patch>;
  refreshing?: Promise<void>;
  again?: boolean;
}

export function runtime(client: typeof Client, Base: typeof Model, def: typeof instruction, Context: typeof Contexts, Route: Model.Type<Routed>) {
  const entries = new WeakMap<Model, Entry>();
  const made = new WeakMap<Definition, Model.Type>();
  const twins = new Map<string, WeakRef<Model>>();
  const released = new Set<string>();
  const lost = new FinalizationRegistry<string>(id => {
    twins.delete(id);
    released.add(id);
  });
  const connection = crypto.randomUUID();
  let source: EventSource | undefined;
  let epoch: string | undefined;
  let syncing = false;

  const { send, define, pathOf } = client({
    headers() {
      const release: Record<string, string> = released.size ? { "x-expressive-release": [...released].join(",") } : {};
      released.clear();

      return { "x-expressive-connection": connection, ...release };
    },
    async reply(res) {
      const next = res.headers.get("x-expressive-epoch");

      if (next && adopt(next)) await rejoin();
    },
  });

  function of(twin: Model): Root {
    return entries.get(twin) as Root;
  }

  function uid(): string {
    return (0.278 + Math.random() * 0.722).toString(36).substring(2, 8).toUpperCase();
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
    on("beat", ({ sum }) => sum !== checksum() && held().forEach(twin => refresh(twin, true)));
  }

  function refresh(twin: Model, whole?: boolean): void {
    const entry = of(twin);

    if (entry.refreshing) return void (entry.again = true);

    entry.refreshing = attach(twin, whole)
      .catch(() => {})
      .then(() => {
        entry.refreshing = undefined;

        if (entry.again) {
          entry.again = false;
          refresh(twin);
        }
      });
  }

  function checksum(): number {
    let sum = 0;

    const add = (state: Model, key: string) => {
      const { version, kids } = of(state);

      if (version) sum = (sum ^ fnv(`${key}@${version}`)) >>> 0;
      kids.forEach(({ child }, field) => add(child, `${key}.${field}`));
    };

    for (const twin of held()) add(twin, of(twin).id);

    return sum;
  }

  function fnv(text: string): number {
    let hash = 0x811c9dc5;

    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);

    return hash >>> 0;
  }

  function apply(frame: Record<string, Patch>, ready?: Model): void {
    for (const key of Object.keys(frame).sort()) {
      const [id, ...path] = key.split(".");
      const twin = twins.get(id)?.deref();
      const { patch, version } = frame[key];

      if (!twin) continue;

      const entry = of(twin);

      if (twin !== ready && !entry.version) {
        const early = (entry.early ??= new Map());
        const prior = early.get(key);

        early.set(key, { patch: { ...prior?.patch, ...patch }, version });
        continue;
      }

      const held = path.reduce<{ child: Model; generation?: string } | undefined>((at, field) => at && of(at.child).kids.get(field), { child: twin });
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
      const { pending } = of(twin);

      pending.add(key);

      return {
        get get() {
          return pending.has(key);
        },
        set() {
          if (!syncing) throw new Error(`${twin}.${key} is read-only - change it through a method.`);
        },
      };
    });
  }

  function sync(twin: Model, values: Record<string, unknown>, version: string): void {
    const entry = of(twin);
    const [generation, counter] = version.split(":");
    const [held, at] = entry.version?.split(":") ?? [];
    const whole = held !== generation;

    if (!whole && Number(counter) < Number(at)) return;

    const { shape: { fields, children }, pending } = entry;

    if (whole) values = Object.fromEntries(fields.map(field => [field, values[field]]));

    for (const field of Object.keys(values))
      if (!isPending(values[field])) pending.delete(field);
      else if (whole) {
        pending.add(field);
        values[field] = undefined;
      }
      else delete values[field];

    if (children) values = nest(twin, values, children);

    entry.version = version;
    syncing = true;

    try {
      twin.set(values);
    } finally {
      syncing = false;
    }
  }

  function isPending(value: unknown): boolean {
    return (value as { $pending?: unknown } | null)?.$pending === true;
  }

  function since(twin: Model): Record<string, string> {
    const { version } = of(twin);
    return version ? { "if-none-match": version } : {};
  }

  async function attach(twin: Model, whole?: boolean): Promise<void> {
    const entry = of(twin);
    const { id, pool } = entry;
    const reply = await send(where(twin), { "x-expressive-get": pool ?? "default", "x-expressive-twin": id, ...(whole ? {} : since(twin)) }, []);

    if (twin.get(null)) return void released.add(id);
    if (reply) apply(reply.frame, twin);

    const { early } = entry;

    if (early) {
      entry.early = undefined;
      apply(Object.fromEntries(early));
    }
  }

  function nest(owner: Model, values: Record<string, unknown>, children: Record<string, Definition>): Record<string, unknown> {
    const { kids: held, root } = of(owner);
    const out = { ...values };

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
        held.set(field, { generation: marker.$child, child: new (classOf(children[field]) as any)(root) });

      out[field] = held.get(field)!.child;
    }

    return out;
  }

  function classOf(definition: Definition): Model.Type {
    let Child = made.get(definition);

    if (Child) return Child;

    const named = {
      [definition.name]: class extends Base {
        constructor(root: Model) {
          super();

          entries.set(this, { root, shape: definition, pending: new Set(), kids: new Map() });

          for (const field of definition.fields) (this as any)[field] = served();
        }
      },
    };

    Child = named[definition.name] as unknown as Model.Type;
    made.set(definition, Child);
    methods(Child, definition.methods);

    return Child;
  }

  function methods(Type: Model.Type, ids: Record<string, string>): void {
    for (const [method, id] of Object.entries(ids))
      Object.defineProperty(Type.prototype, method, {
        configurable: true,
        writable: true,
        value(this: Model, ...args: unknown[]) {
          return invoke(of(this).root, id, args);
        },
      });
  }

  async function rejoin(): Promise<void> {
    await Promise.all(held().map(twin => attach(twin)));
  }

  function leave(twin: Model): void {
    const { id } = of(twin);

    lost.unregister(twin);
    twins.delete(id);
    released.add(id);
  }

  async function invoke(twin: Model, name: string, args: unknown[]): Promise<unknown> {
    const { id, attaching } = of(twin);

    await attaching;

    const reply = await send(where(twin, name), { "x-expressive-call": name, "x-expressive-twin": id, ...since(twin) }, args);

    apply(reply.frame);

    return reply.value;
  }

  function held(): Model[] {
    return [...twins.values()].map(ref => ref.deref()).filter(twin => twin !== undefined);
  }

  function where(twin: Model, name = "default"): string {
    const { pattern, pool, path } = of(twin);
    return pool ? path! : pathOf(pattern, name, routeOf(twin)?.router.path);
  }

  function routeOf(twin: Model): Routed | undefined {
    return Context.get(twin).get(Route, false);
  }

  function place(twin: Model): void {
    const entry = of(twin);
    const route = routeOf(twin);

    entry.path = route ? pathOf(split(route.base + route.router.segment(route.to)), entry.name, route.router.path) : "/.expressive/detached";
  }

  function split(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  function twin(pattern: string[], ids: Record<string, string>, fields: string[], name: string, pool?: string, children?: Record<string, Definition>): Model.Type {
    const named = {
      [name]: class extends Base {
        constructor(...args: any[]) {
          super(...args, ...(pool ? [] : [(self: Model) => of(self).attaching]));

          const id = `${name}-${uid()}`;
          const entry: Root = { root: this, id, name, pattern, pool, shape: { fields, children }, pending: new Set(), kids: new Map() };

          entries.set(this, entry);
          twins.set(id, new WeakRef(this));
          lost.register(this, id, this);
          listen();

          for (const field of fields) (this as any)[field] = served();

          this.set(null, () => leave(this));
          entry.attaching = Promise.resolve().then(() => (pool && place(this), attach(this)));
        }
      },
    };
    const Twin = named[name];

    methods(Twin, ids);

    if (!pool) Twin.on({ catch: (error, kind) => (kind == "setup" ? undefined : error) });

    return Twin;
  }

  return { call, define, twin };
}
