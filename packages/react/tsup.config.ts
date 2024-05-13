import { defineConfig } from 'tsup';

export default defineConfig({
  dts: true, // Generate .d.ts files
  sourcemap: true, // Generate sourcemaps
  clean: true, // Clean output directory before building
  outDir: "dist", // Output directory
  treeshake: false,
  external: ["./adapter"],
  entry: {
    "index": 'src/index.ts',
    "adapter": 'src/adapter.ts'
  }, // Entry point(s)
  format: ['cjs'], // Output format(s)
});