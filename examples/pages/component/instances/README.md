# Instances

An activated instance is an element. Hold one as a field and that field
becomes the switch.

## What to try

Type into one panel, switch to the other, then come back - the text is still
there. Close them both and reopen; still there.

## What it teaches

**Assigning swaps the view.** `active` holds a `Panel`, so rendering `{active}`
renders that panel. Assigning a different instance changes what is on screen
without constructing anything.

**Leaving the tree is not dying.** The panel that scrolls out of view keeps its
state, because the field decides what *renders* - never what *exists*. Both
panels are alive the whole time.

**Bare construction means nested state.** `new Panel({ name: 'Draft' })` at the
field makes the panel something the workspace owns, rather than something the
tree creates and discards.

## Where to look next

- **props** covers what those constructor and JSX arguments actually do.
- **has** owns a whole collection of instances instead of two named fields.
