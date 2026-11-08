type Declaration = Record<string, unknown>;

interface Block {
  declarations: Declaration;
  group?: true;
  name: string;
  ordinal: number;
  when?: readonly Condition[];
}

type Condition = string | { on: Block; state: string };

interface ResolvedAppearance {
  blocks?: Block[];
  classes?: string[];
  context?: AppearanceContext;
  declarations?: Declaration;
}

interface AppearanceContext {
  readonly scope?: unknown;
  readonly base?: object;
  resolve(
    props: Record<string, unknown>,
    tag?: string
  ): ResolvedAppearance | undefined;
}

type EnterAppearance = (parent?: AppearanceContext, key?: string) => AppearanceContext | undefined;
type Emit = (block: Block, depth: number, document: Document) => string;

const SUBCOMPONENT = /^_[A-Z]/;
const registrations = new WeakMap<object, EnterAppearance>();
const tokens = new WeakMap<object, ResolvedAppearance>();
let emitter: Emit | undefined;

function registerAppearance(type: object, enter: EnterAppearance) {
  registrations.set(type, enter);
}

function registerEmitter(emit: Emit) {
  emitter = emit;
}

function emitClass(block: Block, depth: number, document: Document) {
  return emitter!(block, depth, document);
}

function enterAppearance(type: Function, key?: string) {
  const chain: EnterAppearance[] = [];
  let parent: AppearanceContext | undefined;
  let current: object | null = type;

  while (current && current !== Function.prototype) {
    const enter = registrations.get(current);
    if (enter) chain.unshift(enter);
    current = Object.getPrototypeOf(current);
  }

  for (const enter of chain) parent = enter(parent, key);
  return parent;
}

function reserved(key: string) {
  if (SUBCOMPONENT.test(key))
    throw new Error(`"${key}" is reserved for subcomponents in style() maps.`);
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
  appearanceToken,
  createAppearanceToken,
  emitClass,
  enterAppearance,
  registerAppearance,
  registerEmitter,
  reserved,
  SUBCOMPONENT
};

export type { AppearanceContext, Block, Condition, Declaration, ResolvedAppearance };
