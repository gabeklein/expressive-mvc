type Declaration = Record<string, unknown>;

interface Block {
  declarations: Declaration;
  name: string;
  ordinal: number;
}

interface ResolvedAppearance {
  blocks?: Block[];
  classes?: string[];
  context?: AppearanceContext;
  declarations?: Declaration;
}

interface AppearanceContext {
  readonly scope?: unknown;
  resolve(
    route: unknown,
    tag: string,
    props: Record<string, unknown>
  ): { appearance?: ResolvedAppearance; route?: unknown };
}

type EnterAppearance = (parent?: AppearanceContext) => AppearanceContext;
type Emit = (block: Block, depth: number, document: Document) => string;

const registrations = new WeakMap<object, EnterAppearance>();
const tokens = new WeakMap<object, ResolvedAppearance>();
let root: (() => AppearanceContext | undefined) | undefined;
let emitter: Emit | undefined;

function registerAppearance(type: object, enter: EnterAppearance) {
  registrations.set(type, enter);
}

function registerAppearanceRoot(factory: () => AppearanceContext | undefined) {
  root = factory;
}

function registerEmitter(emit: Emit) {
  emitter = emit;
}

function emitClass(block: Block, depth: number, document: Document) {
  return emitter!(block, depth, document);
}

function appearanceRoot() {
  return root?.();
}

function enterAppearance(parent: AppearanceContext | undefined, type: Function) {
  const chain: EnterAppearance[] = [];
  let current: object | null = type;

  while (current && current !== Function.prototype) {
    const enter = registrations.get(current);
    if (enter) chain.unshift(enter);
    current = Object.getPrototypeOf(current);
  }

  for (const enter of chain) parent = enter(parent);
  return parent;
}

function createAppearanceToken(appearance: ResolvedAppearance) {
  const token = {};
  tokens.set(token, appearance);
  return token;
}

function appearanceToken(value: unknown) {
  return value && typeof value == 'object' ? tokens.get(value) : undefined;
}

export {
  appearanceRoot,
  appearanceToken,
  createAppearanceToken,
  emitClass,
  enterAppearance,
  registerAppearance,
  registerAppearanceRoot,
  registerEmitter
};

export type { AppearanceContext, Block, Declaration, ResolvedAppearance };
