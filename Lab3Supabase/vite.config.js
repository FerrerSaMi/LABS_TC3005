import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // El archivo .env del proyecto está dentro de la carpeta supabase.
  envDir: 'supabase',
})
