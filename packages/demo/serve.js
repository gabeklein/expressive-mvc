#!/usr/bin/env node

const { resolve } = require("path");
const Webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const HtmlWebpackPlugin = require("html-webpack-plugin");

const {
  port = 8080,
  _: [
    main = "./src/index.tsx"
  ]
} = require('simple-argv');

const SERVER_OPTIONS = {
  port,
  host: "0.0.0.0",
  historyApiFallback: true,
  hot: true
};

/** @type {Webpack.Configuration} */
const CONFIG = {
  mode: "development",
  entry: resolve(main),
  stats: "errors-only",
  output: {
    path: resolve("./public"),
    publicPath: "/"
  },
  resolve: {
    extensions: [
      ".js",
      ".ts",
      ".jsx",
      ".tsx"
    ]
  },
  module: {
    rules: [
      // {
      //   test: /\.[jt]sx?$/,
      //   exclude: /node_modules/,
      //   use: "swc-loader"
      // },
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              "@babel/typescript",
              "@expressive/babel-preset-react"
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader"
        ]
      },
      {
        test: /\.(svg|png|jpg|otf)$/i,
        type: "asset/resource",
        generator: {
          filename: `static/[hash:10][ext]`
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: resolve(__dirname, "./index.html")
    })
  ]
}

new WebpackDevServer(SERVER_OPTIONS, Webpack(CONFIG)).start();