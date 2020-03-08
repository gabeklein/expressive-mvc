import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',
  output: {
    dir: 'lib',
    format: 'cjs',
    exports: 'named'
  },
  external: ['react'],
  plugins: [
    typescript(),
    commonjs()
  ],
  onwarn: (message, warn) => {
    if(message.code !== "CIRCULAR_DEPENDENCY")
      warn(message);
  }
}