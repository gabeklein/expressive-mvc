---
'@expressive/mvc': patch
---

Generic `Component` subclasses now type in JSX - `<Table rows={rows} />` infers `T` and `<Table<Row> />` accepts explicit arguments, where both previously failed with a circular mapped type (TS2615).
