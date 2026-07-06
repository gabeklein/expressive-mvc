import code from '@/components/Snippet';

export function Molecules() {
  return (
    <section className="border-b border-fd-border">
      <div className="mx-auto max-w-(--content-width) py-24 px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="text-xs uppercase tracking-widest text-fd-muted-foreground mb-3">
              Atoms &amp; molecules
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Headless atoms. Rendered molecules.
            </h2>
            <p className="text-fd-muted-foreground text-lg mb-4">
              A <code className={mono}>State</code> class is a headless atom -
              pure logic and data, no UI. A <code className={mono}>Component</code>{' '}
              is a molecule: it owns state <em>and</em> renders itself, pulling
              atoms from context with no prop drilling.
            </p>
            <p className="text-fd-muted-foreground text-lg">
              Which frees your function components to go back to what they're
              best at - stateless structure and style.
            </p>
          </div>

          <div className="min-w-0">
            <Example />
          </div>
        </div>
      </div>
    </section>
  );
}

const mono = 'font-mono text-sm bg-fd-muted px-1.5 py-0.5 rounded';

const Example = code /*tsx*/`
  import State, { Component, get } from '@expressive/react';

  // atom — headless logic, no UI
  class Cart extends State {
    items: Item[] = [];

    get total() {
      return this.items.reduce((sum, i) => sum + i.price, 0);
    }
  }

  // molecule — owns presentation, reads the atom from context
  class CartBadge extends Component {
    cart = get(Cart);

    render() {
      return (
        <span>
          {this.cart.items.length} items · {this.cart.total}
        </span>
      );
    }
  }
`;
