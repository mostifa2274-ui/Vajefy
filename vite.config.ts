import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  server: { port: 8080 },
  preview: { port: 8081 },
  resolve: { tsconfigPaths: true },
  plugins: [
    // Builds the server for Cloudflare Workers (configured in wrangler.jsonc)
    // and runs it in the Workers runtime during dev and preview. wrangler.jsonc
    // points `main` at the built output for `wrangler deploy`; the build itself
    // starts from TanStack Start's server entry.
    cloudflare({
      viteEnvironment: { name: "ssr" },
      config: { main: "./src/server.ts" },
    }),
    tailwindcss(),
    // No prerendering: Quiz, Words and Notebook read their starting state from
    // the query string, which static HTML would ignore. Pages are rendered by
    // the Worker; scripts, data and images are served as static assets.
    tanstackStart(),
    viteReact(),
  ],
});
