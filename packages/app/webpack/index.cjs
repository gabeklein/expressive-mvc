const { resolve } = require('node:path');

/** Add TSX and Expressive hot patching to a NativeScript webpack config. */
function expressive(webpack) {
  webpack.chainWebpack((config, env) => {
    config.resolve.extensions.prepend('.tsx');
    config.module.rule('ts').test([/\.tsx?$/]);

    if (env.hmr)
      config.module
        .rule('expressive-hot')
        .enforce('post')
        .test(/\.tsx?$/)
        .use('expressive-hot')
        .loader(resolve(__dirname, 'loader.cjs'));
  });
}

module.exports = { expressive };
