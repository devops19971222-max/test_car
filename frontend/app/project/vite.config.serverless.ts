import { defineConfig } from "vite";
import path from "path";

const nodeBuiltins = [
  "fs",
  "path",
  "url",
  "http",
  "https",
  "os",
  "crypto",
  "stream",
  "util",
  "events",
  "buffer",
  "querystring",
  "child_process",
  "async_hooks",
  "worker_threads",
];

export default defineConfig({
  build: {
    ssr: true,
    outDir: "dist/serverless",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "server/vercel-entry.ts"),
      formats: ["es"],
      fileName: "_handler",
    },
    rollupOptions: {
      external: nodeBuiltins.map((m) => [m, `node:${m}`]).flat(),
      output: {
        format: "es",
        entryFileNames: "_handler.mjs",
      },
    },
    minify: false,
    sourcemap: true,
    target: "node20",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
