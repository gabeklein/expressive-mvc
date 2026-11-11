---
"@expressive/dom": patch
---

The `@expressive/dom/vite` hot plugin registers function components only in modules importing `@expressive/dom`, its JSX runtime included. Components on another runtime, such as React email templates compiled for a server environment, no longer get dom's refresh import, which failed to resolve where `@expressive/dom` isn't installed.
