import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var devProxy = {
    '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
    },
    // Same-origin proxy so browser calls OpenRouter without CORS issues
    '/openrouter-api': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        secure: true,
        rewrite: function (path) { return path.replace(/^\/openrouter-api/, '/api/v1'); },
    },
};
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: devProxy,
    },
    preview: {
        proxy: devProxy,
    },
});
