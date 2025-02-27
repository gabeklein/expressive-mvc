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
      "adapter": 'src/adapter.ts',
      "jsx-runtime": 'src/jsx-runtime.ts',
    },
    format: ['cjs'],
  },
  {
    sourcemap: true,
    outDir: "dist/esm",
    external: ["./adapter", "./context"],
    outExtension: () => ({ js: '.js' }),
    entry: {
      "index": 'src/index.ts',
      "adapter": 'src/adapter.ts',
      "context": 'src/context.ts',
      "jsx-runtime": 'src/jsx-runtime.ts'
    },
    format: ['esm'],
  }
]);