import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'src/index.ts',
  output: {
    dir: 'lib',
    format: 'cjs'
  },
  plugins: [
    typescript(),
    commonjs()
  ],
  onwarn: (message, warn) => {
    if(message.code !== "CIRCULAR_DEPENDENCY")
      warn(message);
  }
}