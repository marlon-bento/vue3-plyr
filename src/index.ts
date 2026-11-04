// ============================================================================
// Ponto de entrada da biblioteca vue3-plyr que exporta o componente, o plugin
// de instalação global do Vue e todas as tipagens necessárias.
// ============================================================================

import type { App, Plugin } from 'vue'
import VuePlyr from './VuePlyr.vue'
import {
  PLYR_OPTIONS_KEY,
  type VuePlyrOptions,
  type VuePlyrPluginOptions,
  type VuePlyrExpose,
  type ProvedorPlyr
} from './types'

const VuePlyrPlugin: Plugin = {
  install(app: App, options: VuePlyrPluginOptions = {}) {
    if (options.plyr) {
      app.provide(PLYR_OPTIONS_KEY, options.plyr)
    }
    app.component('VuePlyr', VuePlyr)
  }
}

export { VuePlyr, PLYR_OPTIONS_KEY }
export type { VuePlyrOptions, VuePlyrPluginOptions, VuePlyrExpose, ProvedorPlyr }
export default VuePlyrPlugin