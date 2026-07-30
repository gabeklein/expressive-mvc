# Lifecycle

Three seams, three phases.

## What to try

Toggle the probe and watch each seam fire in order, then unwind in reverse.
Resize the window to see the `mount()` listener still working.

## What it teaches

**`new()` runs at construction** - synchronously, and during server render too.
It belongs to setup the instance carries with it, and what it returns is the
teardown for when the instance is destroyed.

**`mount()` runs at commit, client only.** Timers, listeners and anything
reaching for `window` go here. Its return value is the unmount cleanup.

**`ref()` fires when its element attaches** and its cleanup when the element
detaches - which is not the same moment as unmount.

**The transcript outlives the probe.** `entries` lives on `Demo`, so the probe
can log its own destruction to something that is still there afterwards.

## Where to look next

- **headless** owns a lifecycle with no markup at all.
- **ref** covers the element seam on its own.
