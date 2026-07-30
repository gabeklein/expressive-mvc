# Subcomponents

PascalCase methods are seams. `Item` and `Summary` are methods rendered as
`<this.Item />`; they read `this`, so they need no props to reach what they
display, and a subclass overrides one to change how something looks.

`FruitPicker` replaces `Item` alone. `PalettePicker` replaces `Summary` too,
adding a readout the fruit picker has no use for. The selection logic is
written once on the base and neither subclass restates it.
