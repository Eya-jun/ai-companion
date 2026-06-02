import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 监听所有接口(手机/平板通过 LAN IP 访问)
    port: 5173,
    strictPort: false, // 5173 被占时自动找下一个
  },
})
