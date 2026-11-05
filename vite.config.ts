import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// Unique version per build: git commit count + short hash when available,
// otherwise a timestamp. It is:
//  1. exposed to the app as __KATEB_BUILD_VERSION__ (first run of a new
//     version clears stale update-detection flags),
//  2. baked into dist/sw.js (CACHE_VERSION) so a new deploy creates a new
//     CacheStorage bucket and old ones are deleted on activate,
//  3. written to dist/version.json so native shells / support can read it.
function resolveBuildVersion(): string {
  if (process.env.KATEB_BUILD_VERSION) return process.env.KATEB_BUILD_VERSION;
  try {
    const count = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (count && hash) return `${count}-${hash}`;
  } catch { /* not a git checkout — fall through */ }
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
}
const BUILD_VERSION = resolveBuildVersion();

function versionStampPlugin() {
  return {
    name: 'kateb-version-stamp',
    // public/ files are copied to dist before writeBundle, so patch the
    // emitted dist/sw.js + write dist/version.json here — no timing games.
    writeBundle() {
      try {
        const swOut = path.resolve(__dirname, 'dist/sw.js');
        if (fs.existsSync(swOut)) {
          const stamped = fs.readFileSync(swOut, 'utf8').replaceAll('__KATEB_SW_VERSION__', BUILD_VERSION);
          fs.writeFileSync(swOut, stamped);
        }
        fs.writeFileSync(
          path.resolve(__dirname, 'dist/version.json'),
          JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString() }),
        );
        console.log(`[kateb] build version: ${BUILD_VERSION}`);
      } catch { /* ignore */ }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  define: {
    __KATEB_BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  publicDir: 'public',
  plugins: [react(), versionStampPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    reportCompressedSize: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
            if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@capacitor')) return 'capacitor';
            if (id.includes('zustand')) return 'state';
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
});
