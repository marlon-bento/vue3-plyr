import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    dedupe: ['vue', 'plyr']
  },
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist'
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VuePlyr',
      fileName: 'vue3-plyr'
    },
    rollupOptions: {
      // Externaliza dependências que não devem ir para o bundle
      external: ['vue', 'plyr'],
      output: {
        globals: {
          vue: 'Vue',
          plyr: 'Plyr'
        },
        exports: 'named'
      }
    }
  }
})