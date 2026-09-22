type Declaration = Record<string, unknown>;

interface ResolvedAppearance {
  className?: string;
  context?: AppearanceContext;
  declarations?: Declaration;
}

interface AppearanceContext {
  readonly scope?: unknown;
  resolve(
    route: unknown,
    tag: string,
    props: Record<string, unknown>,
    document: Document
  ): { appearance?: ResolvedAppearance; route?: unknown };
}

type EnterAppearance = (parent?: AppearanceContext) => AppearanceContext;

const registrations = new WeakMap<object, EnterAppearance>();
const tokens = new WeakMap<object, ResolvedAppearance>();
let root: (() => AppearanceContext | undefined) | undefined;

function registerAppearance(type: object, enter: EnterAppearance) {
  registrations.set(type, enter);
}

function registerAppearanceRoot(factory: () => AppearanceContext | undefined) {
  root = factory;
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
  enterAppearance,
  registerAppearance,
  registerAppearanceRoot
};

export type { AppearanceContext, Declaration, ResolvedAppearance };
