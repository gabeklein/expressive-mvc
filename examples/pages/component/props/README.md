# Props

Every state field is an optional JSX prop, reapplied on each render - so
whoever passes one owns it.

## What to try

Pick a preset and watch **CPU** follow it. Nudge CPU with its own buttons: the
change holds only until the next render above reapplies the preset. **Disk**
keeps whatever you set, because nothing upstream is passing its value.

## What it teaches

**Fields are props, and props win.** A field passed from JSX is reapplied every
render, so the parent is the owner of that value. A field nobody passes stays
the component's own.

**`is` seeds without owning.** `is={(disk) => (disk.value = 128)}` runs once at
construction, so Disk starts at 128 and then keeps its own value - the
difference between initializing and controlling.

**`render` parameters are required props.** `unit` is declared on `render`
rather than as a field. That keeps it out of state entirely, and because it is
non-optional there, it becomes a required attribute.

## Where to look next

- **instances** holds constructed components as fields instead of passing
  props to them.
- **set** validates or reacts to a field however it was assigned.
