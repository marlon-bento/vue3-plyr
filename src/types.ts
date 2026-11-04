// ============================================================================
// Definições de tipos, interfaces de propriedades, eventos e chaves de injeção
// da biblioteca vue3-plyr.
// ============================================================================

import type { InjectionKey, ShallowRef, Ref } from 'vue'
import type Plyr from 'plyr'

export type ProvedorPlyr = 'youtube' | 'vimeo' | 'html5' | 'audio'

export interface VuePlyrOptions extends Plyr.Options {
  hideYouTubeDOMError?: boolean
}

export interface VuePlyrPluginOptions {
  plyr?: VuePlyrOptions
}

export interface VuePlyrExpose {
  player: ShallowRef<Plyr | null>
  isReady: Ref<boolean>
  isLoading: Ref<boolean>
  isPlaying: Ref<boolean>
  play: () => void | Promise<void>
  pause: () => void
  stop: () => void
  restart: () => void
  togglePlay: (toggle?: boolean) => void
  setSource: (novaFonte: Plyr.SourceInfo) => void
}

export const PLYR_OPTIONS_KEY: InjectionKey<VuePlyrOptions> = Symbol('VuePlyrOptions')