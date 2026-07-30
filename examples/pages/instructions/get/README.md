# Context Collection

One instruction reaches both directions of the context tree: `get(Poll)` looks
up, `get(Candidate, true)` looks down.

## What to try

Click a name to choose it - every candidate restyles and the tally updates.
Add a guest with the form and watch the count grow without anything
registering it.

## What it teaches

**Downstream collection.** `get(Candidate, true)` gives `Poll` an array of
every `Candidate` mounted beneath it. The array tracks mounts and unmounts on
its own; members never register themselves and the parent never holds a list.

**Upstream lookup.** `get(Poll)` hands each `Candidate` the poll it lives
under. A click writes `poll.choice` directly, so the shared value is the only
thing coordinating the group - no callback props threaded down.

**Reads decide re-renders.** `Tally` renders when the roster changes *and*
when the choice changes, because it read both. Nothing declares that.

## Where to look next

- **map** keys owned members instead of collecting mounted ones.
- **has** owns a pool the parent spawns itself.
