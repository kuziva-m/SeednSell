import { defineConfig } from "vite";
import { resolve } from "path";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    legacy({
      targets: ["defaults", "not IE 11"],
    }),
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        auth: resolve(__dirname, "auth.html"),
        contact: resolve(__dirname, "contact.html"),
        dashboard: resolve(__dirname, "dashboard.html"),
        listing: resolve(__dirname, "listing.html"),
        messages: resolve(__dirname, "messages.html"),
        program: resolve(__dirname, "program.html"),
        404: resolve(__dirname, "404.html"),
      },
    },
  },
});
