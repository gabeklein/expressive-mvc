# Owned List

Give `has` a type instead of a class and it stores plain values by position
rather than spawning members. Push to append, pop to undo - an ordered log with
no keys and no identity to manage.

Reads track precisely: `get(-1)` re-renders on a new tail, `size` on a length
change, and a consumer reading one ignores the other. Negative indices count
from the end, so the latest entry needs no arithmetic.
