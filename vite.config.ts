import { defineConfig } from 'vite'
//import reactRefresh from '@vitejs/plugin-react-refresh'
const reactRefresh = require('./reactBabelRefreshPlugin').default

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: { find: 'path', replacement: 'path-browserify' },
  },
  define: {
    process: {},
  },
  plugins: [reactRefresh()],
})
