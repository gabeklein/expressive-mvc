const jsxPlugin = require('@expressive/vite-plugin-jsx');
const react = require('@vitejs/plugin-react');
const { createServer } = require('vite');
const { resolve } = require('path');

createServer({
  configFile: false,
  root: resolve(__dirname, "fetch"),
  build: {
    rollupOptions: {
      input: {
        index: '../serve.html',
      },
    },
  },
  plugins: [
    jsxPlugin(),
    react(),
    // html()
  ],
  server: {
    port: 1337,
  },
})
.then(server => server.listen())
.then(server => server.printUrls())

function html(){
  return {
    name: 'my-plugin-for-index-html-build-replacement',
    transformIndexHtml: {
      enforce: 'pre', // Tells Vite to run this before other processes
      async transform() {
        throw new Error("wut");

        // Do some logic; whatever you want
        if (env.MY_ENV_VARIABLE == 'myType2') {

          // Grab new HTML content to place into index.html
          return await fs.readFile('./index_type2.html', 'utf8')
        }
      }
    }
  }
}