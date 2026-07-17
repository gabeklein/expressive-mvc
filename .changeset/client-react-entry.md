---
'@expressive/react': patch
---

Mark the React package entry as a client boundary so Next.js can import it from Server Component modules without treating React hooks and context as server-only code.
