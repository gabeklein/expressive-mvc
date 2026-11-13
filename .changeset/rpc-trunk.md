---
"@expressive/rpc": minor
---

Trunks: an `index.ts` whose default export is an object of calls and Error classes imported from its folder is that folder's trunk. The client imports it as that object of stubs, and each leaf keeps its own module's path, id and gates. Under a trunk, only its leaves are served, and a module's other exports stay on the server unchecked. Client code that imports any other module in the trunk's folder fails the build.
