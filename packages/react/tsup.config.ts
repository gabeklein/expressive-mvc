import { defineConfig } from 'tsup';

export default defineConfig({
  dts: true, // Generate .d.ts files
  sourcemap: true, // Generate sourcemaps
  clean: true, // Clean output directory before building
  outDir: "dist", // Output directory
  treeshake: false,
  external: ["./hooks"],
  entry: {
    "index": 'src/index.ts',
    "hooks": 'src/hooks/index.ts'
  }, // Entry point(s)
  format: ['cjs'], // Output format(s)
});