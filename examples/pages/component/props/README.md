# Props

Every state field is an optional JSX prop, reapplied on each render - so
whoever passes one owns it. **CPU** takes its value from above, and its own
buttons only hold until the next render up there reapplies the preset.

`is` seeds without owning: **Disk** starts at 128 and then keeps whatever you
set, which is the difference between initializing and controlling. `unit` is
declared on `render` instead of as a field, keeping it out of state and - being
non-optional there - making it a required attribute.
