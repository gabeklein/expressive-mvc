import { defineConfig } from 'tsup';

export default defineConfig([
  {
    clean: true,
    dts: true,
    entry: ["src/index.ts"],
    format: ['cjs'],
    outDir: "dist",
    sourcemap: true,
  },
  {
    bundle: false,
    format: ['esm'],
    outDir: "dist/esm",
    sourcemap: "inline",
    outExtension: () => ({ js: '.js' }),
    entry: [
      "src/**/*.ts",
      "!src/**/*.test.ts",
      "!src/**/mocks.ts"
    ]
  }
]);