import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

import manifest from "./manifest.json";

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      // The new-collection dialog isn't referenced by the manifest, so list it
      // explicitly; it's opened via chrome.runtime.getURL from the background.
      input: { dialog: "src/dialog/index.html" },
    },
  },
});
