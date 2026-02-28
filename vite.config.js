import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    // Load all env vars so we can use them inside the config
    const env = loadEnv(mode, process.cwd(), '');

    // The local backend to proxy /api calls to during development.
    // Override with VITE_DEV_BACKEND in your .env if your backend
    // runs on a different port or host.
    const devBackend = env.VITE_DEV_BACKEND || 'http://localhost:4000';

    return {
        plugins: [react()],

        // ── Dev server ────────────────────────────────────────────
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: devBackend,
                    changeOrigin: true,
                },
            },
        },

        // ── Production preview (vite preview) ────────────────────
        preview: {
            port: 4173,
            proxy: {
                '/api': { target: devBackend, changeOrigin: true },
            },
        },

        // ── Production build ──────────────────────────────────────
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            // Disable inline source maps for smaller, cleaner prod bundles
            sourcemap: false,
            rollupOptions: {
                output: {
                    // Split react into its own chunk for better long-term caching
                    manualChunks: {
                        react: ['react', 'react-dom'],
                    },
                },
            },
        },
    };
});
