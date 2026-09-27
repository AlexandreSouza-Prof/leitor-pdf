import { defineConfig } from 'vite';

export default defineConfig({
  base: '/leitor-pdf/',
  server: {
    port: 5173,
    open: false
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'lucide']
  }
});
