import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      include: /\.(?:jsx|tsx|js)$/, // Explicitly include .js files
    }),
  ],
  // Add server proxy configuration
  server: {
    proxy: {
      // Proxy requests starting with /api to the backend server
      '/api': {
        target: 'http://localhost:3001', // Your backend server address
        changeOrigin: true, // Recommended for virtual hosted sites
        // secure: false, // Uncomment if backend is not HTTPS
        // rewrite: (path) => path.replace(/^\/api/, ''), // Uncomment if backend doesn't expect /api prefix
      }
    }
  }
})