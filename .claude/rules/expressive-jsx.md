# Expressive JSX - Build-Time CSS-in-JS

Labeled statements inside component functions are CSS properties extracted at build time. Top-level styles auto-apply to the **outermost returned element**. Named labels create scopes applied via `_name` attributes.

See also:
- [expressive-jsx-macros.md](expressive-jsx-macros.md) - All built-in macros and signatures
- [expressive-jsx-instructions.md](expressive-jsx-instructions.md) - Pseudo-selectors, breakpoints, media queries

## Targeting Elements

Top-level styles attach to the outermost JSX tag. Named labels target children via `_name` attributes. Labels matching a tag/component name auto-select those elements (no `_` needed).

```jsx
function Card({ active }) {
  padding: 20;
  border: 0xddd;
  if (active) {
    borderColor: 0x007bff;
  }

  title: {
    fontSize: 1.2;
    fontWeight: bold;
  }
  body: {
    color: 0x666;
    lineHeight: 1.6;
  }

  return (
    <div>
      <h2 _title>Hello</h2>
      <p _body>Content here</p>
    </div>
  );
}
```

Top-level `padding`/`border` apply to the outer `<div>`. `title:` and `body:` are scoped labels applied via `_title`/`_body`. Labels can nest to mirror DOM hierarchy:

```jsx
sidebar: {
  width: 250;
  nav: {
    display: flex;
    flexDirection: column;
  }
  a: {
    padding: (8, 16);
    $hover: {
      background: 0xf0f0f0;
    }
  }
}
```

Here `nav` and `a` auto-select those tags inside `_sidebar` - no `_` attributes needed.

**Note:** Nested labels also match siblings sharing both names. `sidebar: { foo: { ... } }` selects both `<div _foo />` inside `_sidebar` and `<div _sidebar _foo />` on the same element. Use non-colliding names to avoid unintended matches.

**Lexical scope only:** Label rules are computed statically against the JSX in the same component function. They do **not** transfer to elements passed as `children` from a parent. If a wrapper component renders `<p _desc>{children}</p>`, a `desc: { code: { ... } }` rule in that wrapper has no `<code>` to attach to - the `<code>` tags live in the calling component's JSX. Put rules for those elements in the component that contains them lexically.

## Ordering

Place styles **after** variable declarations and logic, **just above** the return.

## Value Rules

- Integers -> px, decimals -> em, `0` -> no unit
- `0x` prefix for hex colors: `0xff0000` -> `#ff0000`, `0xff000022` -> rgba with alpha
- String values pass through as-is: `fontSize: "2rem"` -> `font-size: 2rem`
- CamelCase values -> kebab-case: `notAllowed` -> `not-allowed`
- Commas for multi-values: `padding: 10, 20` (NOT arrays)
- `$varName` -> `var(--var-name)` (CSS variables)
- Backtick template literals bypass all processing, pass raw CSS through

## Instructions (`$` prefix)

`$name: { ... }` applies pseudo-selectors, media queries, or combinators to a block. See [expressive-jsx-instructions.md](expressive-jsx-instructions.md) for the full list.

Common ones: `$hover`, `$focus`, `$active`, `$disabled`, `$focusVisible`, `$before`, `$after`, `$placeholder`, `$dark`, `$light`, `$sm`, `$md`, `$lg`, `$xl`, `$children`, `$even`, `$odd`.

Nesting works naturally - `$md: { $hover: { ... } }`.

## Conditionals

- `if (expr) { ... }` -> conditional className (runtime toggle)
- `if (expr) { ... } else { ... }` -> else branch supported
- `if (':hover') { ... }` -> CSS pseudo-selector (prefer `$hover` syntax)
- `if ('.active') { ... }` -> class selector
- `if ('& > span') { ... }` -> parent/child selector (`&` references parent)

## className Forwarding

Components automatically accept and forward `className` from props. The generated code concatenates incoming `className` with generated classes using a `_concat` helper.

```jsx
// Input
const Button = ({ label }) => {
  padding: (8, 16);
  return <button>{label}</button>
}

// Output (className auto-injected into destructuring and forwarded)
const Button = ({ className, label }) => {
  return <button className={_concat(className, 'Button_a3f')}>{label}</button>
}
```

If the component uses positional params (`props`), it forwards `props.className` instead.

## CSS Variables

Define on a parent to share values across children without prop drilling:

```jsx
function Page() {
  $contentWidth: "1152px";
  $md: { $contentWidth: "1400px"; }
  return <div><Section /><Section /></div>;
}

function Section() {
  inner: { maxWidth: $contentWidth; margin: 0, auto; }
  ...
}
```

## Style Patterns

Nest labels to mirror DOM hierarchy. Use element/component names as labels for shared base styles, sibling labels for variants:

```jsx
function Actions() {
  display: flex;
  gap: 12;

  button: {
    padding: (8, 16);
    borderRadius: 4;
    cursor: pointer;
    confirm: {
      background: $accent;
      color: white;
    }
    cancel: {
      border: $border;
      $hover: {
        background: $muted;
      }
    }
  }

  return (
    <div>
      <button _confirm>OK</button>
      <button _cancel>Cancel</button>
    </div>
  );
}
```

## Configuration Options

```typescript
interface Options {
  cssModule?: string;    // CSS module import path (for CSS module output)
  macros?: Record<string, Macro>[];       // Custom macro definitions
  instructions?: Record<string, Instruction>[];  // Custom instructions
}
```

## Gotchas

1. Use `0x` for colors, not `#`
2. Commas for multi-values, not arrays
3. Label names cannot match the component name
4. `_` attributes are build-time only, removed from HTML output
5. String if-tests are CSS selectors, not runtime logic
6. Fragments get auto-wrapped in a `<div>` when component has styles
