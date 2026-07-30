# Context Collection

One instruction reaches both directions of the tree. `get(Candidate, true)`
gives the poll an array of every candidate mounted beneath it, tracking mounts
and unmounts on its own - nothing registers itself.

`get(Poll)` is the other direction, handing each candidate the poll it lives
under, so a click writes the shared choice with no callback threaded down.
`Tally` re-renders on both the roster and the choice, because it read both.
