import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  console.log("Received ENV data:")
  console.log(env.VITE_SSL_PRIVATE_KEY_PATH)
  console.log(env.VITE_SSL_CERTIFICATE_PATH)

  return {
    server: {
      https: {
        key: fs.readFileSync(
          path.resolve(__dirname, "./collabsphere.xyz/privkey.pem") ??
          path.resolve(env.VITE_SSL_PRIVATE_KEY_PATH) ??
          '/etc/letsencrypt/live/collabsphere.xyz/privkey.pem',
        ),
        cert: fs.readFileSync(
          path.resolve(__dirname, "./collabsphere.xyz/cert.pem") ??
          path.resolve(env.VITE_SSL_CERTIFICATE_PATH) ??
          '/etc/letsencrypt/live/collabsphere.xyz/cert.pem',
        ),
      },
      host: '0.0.0.0',
    },
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
});
