---
"@expressive/rpc": minor
---

A trunk: `api/trunk.ts` default-exports an object of calls and Error classes imported from the folder, and the client imports it as that object of stubs. Each leaf keeps its own module's path, id and gates. With a trunk, only its leaves are served, a module's other exports stay on the server unchecked, and client code importing any other module under the folder fails the build.
