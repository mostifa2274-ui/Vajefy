import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Which deployment an error report came from (Cloudflare Workers Builds sets the commit).
  define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify((process.env.WORKERS_CI_COMMIT_SHA ?? "local").slice(0, 12)) },
  server: { port: 8080 },
  preview: { port: 8081 },
  resolve: { tsconfigPaths: true },
  plugins: [
    // Runs TanStack Start's SSR environment in the Workers runtime during
    // development and emits standard Cloudflare Build Output for deployment.
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    // No prerendering: Quiz, Words and Notebook read their starting state from
    // the query string, which static HTML would ignore. Pages are rendered by
    // the Worker; scripts, data and images are served as static assets.
    tanstackStart(),
    viteReact(),
  ],
});
