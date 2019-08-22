const { resolve } = require("path");

const dir = path => resolve(__dirname, path);

const babelrc = {
  presets: [ "@babel/react" ],
  plugins: [ "@babel/proposal-class-properties" ]
}

module.exports = {
  context: dir("../"),
  entry: "./examples/src/index.jsx",
  mode: "development",
  output: {
    filename: "bundle.js",
    path: dir("./public")
  },
  devtool: "source-map",
  devServer: {
    contentBase: dir("./public"),
    port: 3000
  },
  stats: {
    modules: false
  },
  resolve: {
    modules: [
      "node_modules",
      "../node_modules"
    ],
    extensions: [".ts", ".jsx", ".js"],
    alias: {
      "use-stateful": dir("../src/index.ts"),
      "react": dir("node_modules/react"),
    }  
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: dir("node_modules"),
        loader: './examples/node_modules/ts-loader'
      }, 
      {
        test: /\.js(x?)$/,
        include: __dirname,
        exclude: dir("node_modules"),
        loader: "./examples/node_modules/babel-loader",
        options: babelrc
      }
    ]
  }
}