const nextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

const withNextra = nextra();

module.exports = {
  ...withNextra,
  webpack: (config, options) => {
    config = withNextra.webpack(config, options);

    config.module.rules.push({
      test: /\.js$/,
      exclude: /node_modules/,
      use: [
        options.defaultLoaders.babel,
        {
          loader: 'babel-loader',
          options: {
            presets: [
              "@babel/preset-typescript",
              "@expressive/babel-preset-react"
            ]
          }
        },
      ],
    })

    return config;
  }
}
