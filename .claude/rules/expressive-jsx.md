# Expressive JSX - Build-Time CSS-in-JS

When writing or editing files that use Expressive JSX syntax, follow these rules.

## How It Works

Labeled statements inside component functions are CSS properties extracted at build time. Top-level styles auto-apply to the **outermost returned element**. Named labels create scopes applied via `_name` attributes.

**Important:** Top-level styles attach to whatever element is returned first - the outermost JSX tag. This means styles intended for a child element must use a named label instead. This applies equally to wrapper components and nested HTML elements:

```jsx
// Wrong - styles apply to <html>, not <body>
function Layout({ children }) {
  display: flex;
  minHeight: `100vh`;
  return (
    <html>
      <head>...</head>
      <body>{children}</body>
    </html>
  );
}

// Correct - label targets <body> by element name
function Layout({ children }) {
  body: {
    display: flex;
    minHeight: `100vh`;
  }
  return (
    <html>
      <head>...</head>
      <body>{children}</body>
    </html>
  );
}
```

```jsx
// Wrong - styles apply to HomeLayout's root, not the div
function Page() {
  padding: 20;
  return <HomeLayout><div>...</div></HomeLayout>;
}

// Correct - label targets the inner div
function Page() {
  content: { padding: 20; }
  return <HomeLayout><div _content>...</div></HomeLayout>;
}
```

## Ordering

Place style statements **after** any variable declarations and logic, **just above** the return. Styles often reference local variables or props, so they belong below the code they depend on.

```jsx
const Card = ({ active }) => {
  padding: 20;              // 20px (integers -> px)
  fontSize: 1.2;            // 1.2em (decimals -> em)
  color: 0x333;             // #333 (0x -> hex color)
  width: fill;              // 100% (keyword)
  cursor: pointer;          // "pointer" (camelCase -> kebab-case)

  if (active) { color: 0x007bff; }     // conditional className
  if (':hover') { opacity: 0.8; }      // CSS pseudo-selector

  title: {
    fontWeight: bold;
    marginBottom: 8;
  }

  return (
    <div>
      <h2 _title>Hello</h2>
    </div>
  );
};
```

## Style Patterns

Prefer nesting labels to reduce total style properties. Group related styles under a parent label to mirror the DOM hierarchy.

### Element-name labels for shared base styles

Use the element or component name as a label to define shared styles, then add sibling variant labels for differences:

```jsx
function Nav() {
  actions: {
    display: flex;
    gap: 12;

    Link: {
      display: inlineFlex;
      alignItems: center;
      borderRadius: round;
      fontWeight: 500;
      padding: 12, 24;
      textDecoration: none;
    }

    primary: {
      background: $colorFdPrimary;
      color: $colorFdPrimaryForeground;
      if (':hover') { opacity: 0.9; }
    }

    secondary: {
      border: $colorFdBorder;
      color: inherit;
      if (':hover') { background: $colorFdMuted; }
    }
  }

  return (
    <div _actions>
      <Link _primary to="/start">Start</Link>
      <Link _secondary to="/docs">Docs</Link>
    </div>
  );
}
```

### Nest scoped selectors and minimize names

If a style only appears within another scope, nest it inside that parent. Use short names - prefer tag names (`code`, `span`) when unambiguous over descriptive labels (`inlineCode`).

Labels matching a tag name automatically select those elements - no `_` attribute needed:

```jsx
// Good - code label auto-selects <code> elements inside desc
desc: {
  color: $colorFdMutedForeground;
  fontSize: 1.125;

  code: {
    fontSize: 0.875;
    background: $colorFdMuted;
    padding: 2, 6;
    borderRadius: 4;
  }
}

// JSX - no _code needed, tag name matching handles it
<p _desc>
  Use <code>useState</code> and <code>useEffect</code>
</p>
```

Only use `_` attributes when the label name doesn't match the tag, or when a longer name is needed to avoid conflicts.

## Value Rules

- Integers -> px, decimals -> em, `0` -> no unit
- `0x` prefix for hex colors: `0xff0000` -> `#ff0000`
- CamelCase values -> kebab-case: `notAllowed` -> `not-allowed`
- `fill` -> `100%`, `round` -> `999px`
- Commas for multi-values: `padding: 10, 20` (NOT arrays)
- `$varName` -> `var(--var-name)` (CSS variables)

## Built-In Macros

| Macro | Example | Output |
|-------|---------|--------|
| `absolute` | `absolute: fill` | position: absolute + all edges 0 |
| `size` | `size: 100, 200` | width: 100px; height: 200px |
| `border` | `border: 0xddd` | border: 1px solid #ddd |
| `radius` | `radius: 8` | border-radius: 8px |
| `shadow` | `shadow: 0xccc` | box-shadow: #ccc 0 0 10px |
| `flexAlign` | `flexAlign: center` | display: flex + centering |
| `marginV`/`marginH` | `marginV: 20` | margin-top + margin-bottom |

## Instructions (`$` prefix blocks)

Instructions apply a context (pseudo-selector or media query) to a block of styles using `$name: { ... }` syntax.

### Pseudo-selectors

```jsx
$hover: { color: red; }          // :hover
$focus: { outline: '2px solid blue'; }
$active: { opacity: 0.8; }
$disabled: { cursor: notAllowed; }
$focusVisible: { outline: '2px solid'; }
$focusWithin: { background: 0xf5f5f5; }
$firstChild: { marginTop: 0; }
$lastChild: { marginBottom: 0; }
$before: { content: '""'; }      // ::before (auto :: for pseudo-elements)
$after: { content: '""'; }       // ::after
$placeholder: { color: 0x999; }  // ::placeholder
```

### Responsive breakpoints (Tailwind defaults)

```jsx
$sm: { ... }   // @media (min-width: 640px)
$md: { ... }   // @media (min-width: 768px)
$lg: { ... }   // @media (min-width: 1024px)
$xl: { ... }   // @media (min-width: 1280px)
```

### Nesting works naturally

```jsx
fontSize: 24;
$md: {
  fontSize: 36;
  $hover: { color: blue; }
}
```

### Works with conditionals and named scopes

```jsx
if (active) {
  color: blue;
  $md: { color: navy; }
}

title: {
  fontSize: 24;
  $md: { fontSize: 36; }
}
```

Prefer `$hover: { ... }` over `if (':hover') { ... }` - they are equivalent but `$` syntax is cleaner.

## Conditionals

- `if (expr)` -> conditional className (runtime)
- `if (':hover')` / `if (':focus')` -> CSS pseudo-selector (prefer `$hover` instead)
- `if ('.active')` -> class selector
- `if ('& > span')` -> parent/child selector
- Else branches and nesting supported

## CSS Variables for Shared Values

Define CSS variables on a parent component to share values (widths, colors, breakpoint-varying properties) across children without prop drilling:

```jsx
export default function Page() {
  $contentWidth: "1152px";
  $md: { $contentWidth: "1400px"; }

  return <div><Section /><Section /></div>;
}

function Section() {
  inner: {
    maxWidth: $contentWidth;
    margin: 0, auto;
  }
  ...
}
```

Prefer this over hardcoding repeated values across sibling components.

## Template Literals for Raw CSS

Use backtick template literals to bypass macro processing and pass values through as raw CSS:

```jsx
background: `color-mix(in srgb, var(--color-fd-muted) 30%, transparent)`;
borderBottom: `1px solid red`;
```

When unsure of a macro's signature, default to template literals rather than quoted strings.

## Gotchas

1. Use `0x` for colors, not `#`
2. Commas for multi-values, not arrays
3. Label names cannot match the component name
4. `_` attributes are build-time only, removed from HTML output
5. String if-tests are CSS selectors, not runtime logic
6. className forwarding is automatic
7. Fragments get auto-wrapped in a `<div>`
