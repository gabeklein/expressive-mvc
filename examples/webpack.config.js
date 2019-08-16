const { resolve } = require("path");

const dir = path => resolve(__dirname, path);

const babelrc = {
  presets: [ "@babel/react" ],
  plugins: [ "@babel/proposal-class-properties" ]
}

module.exports = {
  entry: dir("src/index.jsx"),
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
      dir("node_modules")
    ],
    extensions: [".ts", ".jsx", ".js"],
    alias: {
      "use-stateful": "../../src",
    }  
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: dir("node_modules"),
        loader: 'ts-loader'
      }, 
      {
        test: /\.js(x?)$/,
        include: __dirname,
        exclude: dir("node_modules"),
        loader: "babel-loader",
        options: babelrc
      }
    ]
  }
}