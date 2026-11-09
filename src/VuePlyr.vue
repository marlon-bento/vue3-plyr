<!--
========
Componente principal do VuePlyr que encapsula a instância do Plyr, gerencia a
troca reativa de vídeos, estado de carregamento nativo, eventos e métodos expostos.
========
-->
<script setup lang="ts">
import { ref, shallowRef, computed, inject, onMounted, onBeforeUnmount, watch } from 'vue'
import Plyr from 'plyr'
import 'plyr/dist/plyr.css'
import { PLYR_OPTIONS_KEY, type VuePlyrOptions, type ProvedorPlyr, type VuePlyrExpose } from './types'

const props = withDefaults(
  defineProps<{
    options?: VuePlyrOptions
    source?: Plyr.SourceInfo | null
    videoId?: string | null
    provider?: ProvedorPlyr
    showSpinner?: boolean
  }>(),
  {
    options: () => ({}),
    source: null,
    videoId: null,
    provider: 'youtube',
    showSpinner: true
  }
)

const emit = defineEmits<{
  (e: 'ready', player: Plyr): void
  (e: 'play', event: Plyr.PlyrEvent): void
  (e: 'pause', event: Plyr.PlyrEvent): void
  (e: 'ended', event: Plyr.PlyrEvent): void
  (e: 'timeupdate', event: Plyr.PlyrEvent): void
  (e: 'error', event: unknown): void
  (e: 'loading', estado: boolean): void
}>()

// Opções globais injetadas pelo plugin na inicialização do app
const opcoesGlobais = inject(PLYR_OPTIONS_KEY, {})

// Referência ao container raiz onde o elemento do player está montado
const containerRef = ref<HTMLElement | null>(null)

// Referência ao elemento padrão gerado quando nenhum slot é passado
const elementoPadraoRef = ref<HTMLElement | null>(null)

// Instância reativa superficial do Plyr para evitar overhead de proxy profundo do Vue
const player = shallowRef<Plyr | null>(null)

// Estados reativos do ciclo de vida e reprodução do player
const isReady = ref<boolean>(false)
const isLoading = ref<boolean>(true)
const isPlaying = ref<boolean>(false)

// Define qual tag HTML deve ser criada quando o usuário não passa slot manual
const tagElementoPadrao = computed<'div' | 'video' | 'audio'>(() => {
  if (props.source?.type === 'audio' || props.provider === 'audio') {
    return 'audio'
  }
  if (props.source?.type === 'video' || props.provider === 'html5') {
    return 'video'
  }
  return 'div'
})

// Combina as opções padrão, globais e locais passadas via prop
const opcoesMescladas = computed<VuePlyrOptions>(() => {
  return {
    hideYouTubeDOMError: true,
    ...opcoesGlobais,
    ...props.options,
    youtube: {
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      ...(opcoesGlobais.youtube || {}),
      ...(props.options?.youtube || {})
    }
  }
})

// Constrói o objeto SourceInfo automaticamente quando videoId ou source mudam
const fonteResolvida = computed<Plyr.SourceInfo | null>(() => {
  if (props.source) {
    return props.source
  }
  if (props.videoId) {
    return {
      type: props.provider === 'audio' ? 'audio' : 'video',
      sources: [
        {
          src: props.videoId,
          provider: props.provider === 'youtube' || props.provider === 'vimeo' ? props.provider : undefined
        }
      ]
    }
  }
  return null
})

// Atualiza o estado de carregamento e emite o evento correspondente para o componente pai
function definirEstadoLoading(estado: boolean) {
  isLoading.value = estado
  emit('loading', estado)
}

// Registra os ouvintes de eventos principais na instância do Plyr
function registrarEventos(instancia: Plyr) {
  instancia.on('ready', () => {
    isReady.value = true
    definirEstadoLoading(false)
    emit('ready', instancia)
  })

  instancia.on('play', (event) => {
    isPlaying.value = true
    emit('play', event)
  })

  instancia.on('pause', (event) => {
    isPlaying.value = false
    emit('pause', event)
  })

  instancia.on('ended', (event) => {
    isPlaying.value = false
    emit('ended', event)
  })

  instancia.on('timeupdate', (event) => {
    emit('timeupdate', event)
  })

  instancia.on('error', (event) => {
    definirEstadoLoading(false)
    emit('error', event)
  })
}

// Inicializa a instância do Plyr no elemento alvo disponível no DOM
function inicializarPlayer() {
  if (!containerRef.value || player.value) return

  const alvoSlot = containerRef.value.querySelector('[data-plyr-provider], video, audio, .plyr') as HTMLElement | null
  const elementoAlvo = alvoSlot || elementoPadraoRef.value

  if (!elementoAlvo) return

  definirEstadoLoading(true)
  player.value = new Plyr(elementoAlvo, opcoesMescladas.value)
  registrarEventos(player.value)

  if (fonteResolvida.value && !alvoSlot?.getAttribute('data-plyr-embed-id')) {
    player.value.source = fonteResolvida.value
  }
}

// Troca a fonte de mídia do player ativando o estado de carregamento até ficar pronto
function setSource(novaFonte: Plyr.SourceInfo) {
  if (!player.value) {
    inicializarPlayer()
    return
  }
  isReady.value = false
  definirEstadoLoading(true)
  player.value.source = novaFonte
}

// Inicia a reprodução da mídia atual
function play() {
  return player.value?.play()
}

// Pausa a reprodução da mídia atual
function pause() {
  player.value?.pause()
}

// Para a reprodução e retorna ao início da mídia
function stop() {
  player.value?.stop()
}

// Reinicia a reprodução da mídia desde o início
function restart() {
  player.value?.restart()
}

// Alterna entre reprodução e pausa da mídia atual
function togglePlay(alternar?: boolean) {
  player.value?.togglePlay(alternar)
}

watch(
  fonteResolvida,
  (novaFonte, fonteAntiga) => {
    if (!novaFonte) return
    if (!player.value) {
      inicializarPlayer()
      return
    }
    if (JSON.stringify(novaFonte) !== JSON.stringify(fonteAntiga)) {
      setSource(novaFonte)
    }
  },
  { deep: true }
)

onMounted(() => {
  if (fonteResolvida.value || containerRef.value?.querySelector('[data-plyr-provider], video, audio')) {
    inicializarPlayer()
  } else {
    definirEstadoLoading(false)
  }
})

onBeforeUnmount(() => {
  if (!player.value) return
  try {
    player.value.destroy()
  } catch (erro: unknown) {
    const erroYouTubeDOM =
      erro instanceof Error && erro.message === 'The YouTube player is not attached to the DOM.'
    if (!(opcoesMescladas.value.hideYouTubeDOMError && erroYouTubeDOM)) {
      console.error('[VuePlyr] Erro ao destruir:', erro)
    }
  } finally {
    player.value = null
  }
})

defineExpose<VuePlyrExpose>({
  player,
  isReady,
  isLoading,
  isPlaying,
  play,
  pause,
  stop,
  restart,
  togglePlay,
  setSource
})
</script>

<template>
  <div ref="containerRef" class="vue-plyr-container">
    <div v-if="showSpinner && isLoading" class="vue-plyr-loading-overlay">
      <slot name="loader">
        <div class="vue-plyr-spinner"></div>
      </slot>
    </div>

    <div class="vue-plyr-content" :class="{ 'vue-plyr-hidden': showSpinner && isLoading }">
      <slot>
        <component
          :is="tagElementoPadrao"
          ref="elementoPadraoRef"
          :playsinline="tagElementoPadrao === 'video' ? true : undefined"
          :controls="tagElementoPadrao !== 'div' ? true : undefined"
          :data-plyr-provider="
            tagElementoPadrao === 'div' && (provider === 'youtube' || provider === 'vimeo')
              ? provider
              : undefined
          "
          :data-plyr-embed-id="tagElementoPadrao === 'div' ? videoId || undefined : undefined"
        />
      </slot>
    </div>
  </div>
</template>

<style>
.vue-plyr-container {
  position: relative;
  width: 100%;
}

.vue-plyr-content {
  width: 100%;
}

.vue-plyr-hidden {
  display: none;
}

.vue-plyr-container .plyr--youtube .plyr__video-embed {
  overflow: hidden !important;
}

.vue-plyr-container .plyr--youtube .plyr__video-embed iframe {
  pointer-events: none !important;
  top: -100% !important;
  height: 300% !important;
}

.vue-plyr-loading-overlay {
  aspect-ratio: 16 / 9;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgb(0, 0, 0);
  width: 100%;
}

.vue-plyr-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #ffffff;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: vue-plyr-spin 1s linear infinite;
}

@keyframes vue-plyr-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>