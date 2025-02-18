import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    external: ["./adapter"],
    entry: {
      "index": 'src/index.ts',
      "adapter": 'src/adapter.ts'
    },
    format: ['cjs'],
  },
  {
    sourcemap: true,
    outDir: "dist/esm",
    external: ["./adapter", "./context"],
    entry: {
      "index": 'src/index.ts',
      "adapter": 'src/adapter.ts',
      "context": 'src/context.ts'
    },
    format: ['esm'],
  }
]);