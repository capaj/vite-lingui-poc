import { defineConfig } from 'vite'
const reactBabelRefreshPlugin = require('./reactBabelRefreshPlugin').default

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactBabelRefreshPlugin()],
})
