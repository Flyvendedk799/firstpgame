import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
  },
  // Large GLBs in public/assets/ are served as static files; Vite will not
  // try to import them through its module graph.
});
