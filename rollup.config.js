import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2';

export default  {
  input: 'src/index.ts',
  output: [
    {
      file: 'lib/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true
    },
    {
      file: 'lib/index.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  external: [ 'react' ],
  plugins: [
    typescript(),
    commonjs()
  ]
}