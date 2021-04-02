import { defineConfig } from 'vite'
const reactBabelRefreshPlugin = require('./reactBabelRefreshPlugin').default
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/' + require('./package.json').name + '/',
  plugins: [
    reactBabelRefreshPlugin(),
    legacy({
      targets: ['defaults', 'not ie <= 10']
    })
  ]
})
