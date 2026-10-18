import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // escucha en 0.0.0.0 para ser accesible desde fuera del contenedor
    port: 5173,
    // Las peticiones a /api/* se reenvían al backend. Así el navegador solo habla
    // con un origen (sin problemas de CORS) y la URL real del backend vive aquí.
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:8000",
        changeOrigin: true,
        rewrite: (ruta) => ruta.replace(/^\/api/, ""),
      },
    },
    // En Docker sobre Windows los cambios de archivos no se notifican al
    // contenedor; el "polling" revisa los archivos periódicamente.
    watch: { usePolling: process.env.VITE_USAR_POLLING === "true" },
  },
});
