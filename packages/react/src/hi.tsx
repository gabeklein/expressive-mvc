/**
 * @internal This interface is used for TypeScript type checking only 
 * and not meant to be used directly.
 */
interface ComponentLike {
  /** @deprecated This may be ignored as \@expressive/react augments Model to permit Models as Components in typescript. */
  readonly props: Partial<Omit<this, keyof ComponentLike>>;
  /** @deprecated This may be ignored as \@expressive/react augments Model to permit Models as Components in typescript. */
  readonly setState: never;
  /** @deprecated This may be ignored as \@expressive/react augments Model to permit Models as Components in typescript. */
  readonly forceUpdate: never;
  /** @deprecated This may be ignored as \@expressive/react augments Model to permit Models as Components in typescript. */
  readonly context: never;
  /** @deprecated This may be ignored as \@expressive/react augments Model to permit Models as Components in typescript. */
  readonly state: never;
  /** @deprecated This may be ignored as \@expressive/react augments Model to permit Models as Components in typescript. */
  readonly refs: never;
}

interface C extends ComponentLike {}

class C {
  render() {
    return <div>Hi</div>;
  }

  foo = 3;
}

class D extends C {
  bar = 4;
}

const d = new D();

const x = <D bar={5} />;