import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Config Vitest dédiée : le cœur testable (parsing/ + core/) est du TS pur,
// testable sans lancer Tauri ni Vite (environnement node).
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
