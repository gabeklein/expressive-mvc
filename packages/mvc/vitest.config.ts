import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: './tests.js'
  }
})

// export default {
//   timeout: 1000,
//   ignore: [
//     'index.ts',
//     'dist'
//   ],
//   setup: [
//     './tests.js'
//   ],
//   coverage: {
//     threshold: {
//       global: {
//         branches: 100,
//         functions: 100,
//         lines: 100,
//         statements: 100
//       }
//     }
//   },
//   alias: {
//     '@expressive/(.*)$': '<rootDir>/../$1/src'
//   }
// }