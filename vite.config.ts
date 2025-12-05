import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large libraries into separate chunks
          react: ["react", "react-dom"],
          ui: [
            "framer-motion",
            "lucide-react",
            "three",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-dialog",
          ],
          utils: [
            "lodash",
            "date-fns",
          ],
        },
      },
    },
  },
}));
