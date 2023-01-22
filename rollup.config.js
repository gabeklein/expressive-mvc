import commonjs from '@rollup/plugin-commonjs'
import typescript from 'rollup-plugin-typescript2'
import dts from 'rollup-plugin-dts'

export default  [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'lib/index.js',
        format: 'cjs',
        exports: 'named',
        sourcemap: false
      },
      {
        file: 'lib/index.esm.js',
        format: 'esm',
        sourcemap: false
      }
    ],
    external: [ 'react' ],
    plugins: [
      typescript(),
      commonjs()
    ]
  },
  {
    input: 'src/index.ts',
    output: [{
      file: 'lib/index.d.ts',
      format: 'es'
    }],
    plugins: [
      dts()
    ]
  }
]