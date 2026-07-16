# Style Profile

These are conventions, not library semantics. They ship with the golden path because they materially improve the auditability of reactive dependency snapshots - the refactor algorithm in [refactor.md](refactor.md) applies them by default. A project may override them; when it does, keep the architectural rules and swap only the formatting.

## Snapshot formatting

- When a destructure contains multiple values, put every binding on its own line.
- Direct properties come first; nested destructures go at the bottom.
- Expand nested levels vertically - one key per line, closing braces aligned.
- Optional nested objects take in-place defaults, not a separate unwrap:

```tsx
const {
  blocking,
  hasBlocking,
  result: {
    wssDownload: {
      selectedLocationId,
      usedLogin,
    } = {},
  },
} = ReviewStep.get();
```

## Declaration spacing

- Blank line after a declaration group, before the logic that uses it.
- Blank line before a standalone `if` that follows other statements.
- No blank line when an `if` is the first statement of a function or block.
- Do not separate a chain of consecutive `if` statements.

## Conditions

- Prefer affirmative conditions: test for the state that renders content, not the absence that skips it.
- Conditional JSX uses `condition && <Node />`, not `condition ? <Node /> : null`.
- Nullish fallback uses `??` where the distinction from `||` matters.

## Render fallthrough vs operational guards

React accepts `undefined` as an empty render result. A small optional FC uses an affirmative condition and simply falls through when there is nothing to show - no `return null`, no bare terminal `return`:

```tsx
function ResolvedFeeClassifications() {
  const { classifications } = ReviewStep.get();

  if (classifications?.length) {
    return <ul>{classifications.map(...)}</ul>;
  }
}
```

Do not annotate these components as returning `void` - allow inference.

Operational guards are different: a method controlling a workflow uses explicit `return`, because it guards behavior rather than producing a render result:

```tsx
downloadIif() {
  if (!this.confirmed || this.hasBlocking) return;
  ...
}
```

If a render guard would skip past most of an already-declared snapshot, the gated content is a candidate for its own component - see step 11 of [refactor.md](refactor.md).
