# Instances

An activated instance is an element, so holding one as a field makes that field
the switch. Assign a different instance and the view swaps; rendering
`{active}` is all the wiring there is.

Leaving the tree is not dying. Type in one panel, switch away and come back -
the text is still there, because the field decides what *renders*, never what
*exists*. Both panels are bare-constructed, which makes them nested state the
workspace owns.
