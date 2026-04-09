import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mew': {
        target: 'https://mew.limitlesstcg.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/mew/, ''),
      },
      '/tcgplayer-search': {
        target: 'https://mp-search-api.tcgplayer.com',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/tcgplayer-search/, ''),
      },
    },
  },
})
