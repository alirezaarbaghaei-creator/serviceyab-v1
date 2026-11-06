import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules')) {
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('lucide-react')) return 'icons';
            return 'vendor';
          }
          return undefined;
        }
      }
    }
  }
});
