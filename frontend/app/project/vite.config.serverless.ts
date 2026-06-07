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

// Bundle the Express app for Vercel's serverless runtime.
export default defineConfig({
  build: {
    ssr: true,
    outDir: "dist/serverless",
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, "server/index.ts"),
      formats: ["es"],
      fileName: "handler",
    },
    rollupOptions: {
      external: nodeBuiltins.map((m) => [m, `node:${m}`]).flat(),
      output: {
        format: "es",
        entryFileNames: "handler.mjs",
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
