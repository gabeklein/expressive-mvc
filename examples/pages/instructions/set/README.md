# Managed Slots

`set` manages a slot beyond a plain field - a default, a validator, or a
change-effect - each just a callback. **Display name** rejects anything over
twelve characters by throwing `false`, so the invalid value is never stored.

The same callback may return a cleanup, run before the next change, so
**Search** debounces for free: each keystroke cancels the timer the previous
one started. No `useEffect`, no dependency array, no ref holding the timer.
