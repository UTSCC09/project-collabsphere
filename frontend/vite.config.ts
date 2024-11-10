import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({mode}) => {
    const env = loadEnv(mode, process.cwd());
    return {
      server: {
        https: {
          key: fs.readFileSync(process.env.SSL_PRIVATE_KEY_PATH || path.resolve(__dirname, '../ssl/privkey.pem')),
          cert: fs.readFileSync(process.env.SSL_CERTIFICATE_PATH || path.resolve(__dirname, '../ssl/cert.pem'))
        },
        host: '0.0.0.0',
      },
      plugins: [
        vue(),
        vueDevTools(),
      ],
      resolve: {
        alias: {
          '@': fileURLToPath(new URL('./src', import.meta.url))
        }
     }
  }
});
