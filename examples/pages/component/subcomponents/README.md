# Subcomponents

PascalCase methods are seams. A subclass overrides one to change how something
looks, and inherits everything else.

## What to try

Two pickers, one base class. They share the data handling and the selection
logic; only the parts each one overrode differ.

## What it teaches

**A method that returns markup is a component.** `Item` and `Summary` are
methods on `Picker`, rendered as `<this.Item />`. They read `this`, so they
need no props to reach the state they display.

**Overriding replaces one seam.** `FruitPicker` replaces `Item` alone.
`PalettePicker` replaces `Item` and `Summary`, adding a readout the fruit
picker has no use for.

**Inheritance carries behavior, not just shape.** The selection logic is
written once on the base and neither subclass restates it.

## Where to look next

- **dial** extends a base class the same way to build a custom control.
- **instances** composes with fields instead of with inheritance.
