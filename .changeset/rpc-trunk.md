---
"@expressive/rpc": minor
---

Trunks: an `index.ts` that exports objects of calls and Error classes imported from its folder is that folder's trunk. The client imports the index as a namespace of those groups, with stubs at the leaves. Each leaf keeps its own module's path, id and gates, and the index's default stays the folder's gate. Under a trunk, only its leaves and the index's own calls are served, and a module's other exports stay on the server unchecked. Client code that imports any other module in the trunk's folder fails the build.
