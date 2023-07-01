import Nextra from 'nextra'

const nextra = Nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

const withNextra = nextra();

export default {
  ...withNextra,
  webpack: (config, options) => {
    config = withNextra.webpack(config, options);

    config.module.rules.push({
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: [
        options.defaultLoaders.babel,
        {
          loader: 'babel-loader',
          options: {
            presets: [
              "@babel/preset-typescript",
              ["@expressive/babel-preset-react", {

              }]
            ]
          }
        },
      ],
    })

    return config;
  }
}
