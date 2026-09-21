import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base must match the GitHub Pages repo path: https://<user>.github.io/next-stop/
export default defineConfig({
  base: '/next-stop/',
  plugins: [react(), tailwindcss()],
})
