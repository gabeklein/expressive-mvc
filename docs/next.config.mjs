import Nextra from 'nextra';
import ExpressivePlugin from '@expressive/webpack-plugin';

const nextra = Nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './common/Theme.tsx',
});

export default nextra({
  webpack: (config) => {
    config.plugins.push(
      new ExpressivePlugin()
    );
  }
});