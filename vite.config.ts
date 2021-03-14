import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: [
      { find: 'path', replacement: 'path-browserify' },
    ],
  },
  define: {
    process: {},
  },
  plugins: [reactRefresh()],
});
