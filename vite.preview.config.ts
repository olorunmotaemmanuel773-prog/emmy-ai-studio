// Arena sandbox preview only — wraps the real vite.config.ts and allows the
// e2b preview hostname. The application config itself is unchanged.
import { mergeConfig } from "vite";
import baseConfig from "./vite.config";

export default mergeConfig(baseConfig, {
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: [".e2b.app"],
    // The preview is proxied over HTTPS on port 443, so the HMR websocket must
    // be told to use wss:443 instead of the default ws://<host>:5173, which the
    // proxy does not expose. Without this the client retries forever.
    hmr: { protocol: "wss", clientPort: 443 },
  },
});
