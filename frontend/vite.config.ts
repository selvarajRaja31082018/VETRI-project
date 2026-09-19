import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind all interfaces so a phone on the same network can open the capture
    // page from the QR code - `localhost` is unreachable from another device.
    //
    // NOTE: getUserMedia only works on a secure context. `localhost` counts as
    // one, a bare LAN IP does not, so the phone needs HTTPS. Run the dev server
    // behind a tunnel (ngrok/cloudflared) or add a local TLS cert
    // (e.g. `@vitejs/plugin-basic-ssl`) and point PUBLIC_APP_URL at it.
    host: true,
  },
})
