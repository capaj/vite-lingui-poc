import { defineConfig } from 'vite'
//import reactRefresh from '@vitejs/plugin-react-refresh'
const reactRefresh = require('./looopPlugin').default

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  },
  define: {
    process: {},
  },
  plugins: [reactRefresh()],
})
