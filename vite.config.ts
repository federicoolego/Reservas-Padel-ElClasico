import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En GitHub Pages la app vive en /<nombre-del-repo>/. El workflow pasa BASE_PATH.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH || '/',
})
