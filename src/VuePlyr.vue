<!--
========
Componente principal do VuePlyr que encapsula a instância do Plyr, gerencia a
troca reativa de vídeos, ocultação total da interface, títulos longos e legendas
nativas do YouTube via overscan horizontal amplo sem cortar vídeos verticais,
estado de carregamento, controle direto de progresso (seek) e métodos expostos.
========
-->
<script setup lang="ts">
import { ref, shallowRef, computed, inject, onMounted, onBeforeUnmount, watch, markRaw } from 'vue'
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

// Armazena função de limpeza dos ouvintes manuais da barra de progresso
let limparOuvintesBarra: (() => void) | null = null

// Extrai o ID limpo do vídeo caso tenha sido passada uma URL completa ou link de Short
const idVideoLimpo = computed<string | null>(() => {
  if (!props.videoId) return null
  const valor = props.videoId.trim()

  if (valor.includes('/shorts/')) {
    const partes = valor.split('/shorts/')[1]
    return partes ? partes.split(/[?&/]/)[0] : valor
  }

  if (valor.includes('v=')) {
    const partes = valor.split('v=')[1]
    return partes ? partes.split(/[?&/]/)[0] : valor
  }

  if (valor.includes('youtu.be/')) {
    const partes = valor.split('youtu.be/')[1]
    return partes ? partes.split(/[?&/]/)[0] : valor
  }

  return valor
})

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

// Combina as opções padrão, globais e locais passadas via prop desativando legendas
const opcoesMescladas = computed<VuePlyrOptions>(() => {
  return {
    hideYouTubeDOMError: true,
    seekTime: 10,
    ratio: '16:9',
    captions: {
      active: false,
      update: false
    },
    ...opcoesGlobais,
    ...props.options,
    youtube: {
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      playsinline: 1,
      cc_load_policy: 0,
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
  if (idVideoLimpo.value) {
    return {
      type: props.provider === 'audio' ? 'audio' : 'video',
      sources: [
        {
          src: idVideoLimpo.value,
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

// Descarrega forçadamente os módulos de legenda interna da API do YouTube
function desativarLegendasYouTube(instancia: Plyr) {
  instancia.toggleCaptions(false)

  const embed = (
    instancia as unknown as {
      embed?: {
        unloadModule?: (modulo: string) => void
        setOption?: (modulo: string, opcao: string, valor: unknown) => void
      }
    }
  ).embed

  if (!embed) return

  try {
    if (typeof embed.unloadModule === 'function') {
      embed.unloadModule('captions')
      embed.unloadModule('cc')
    }
    if (typeof embed.setOption === 'function') {
      embed.setOption('captions', 'track', {})
      embed.setOption('cc', 'track', {})
    }
  } catch {
    // Ignora caso o player do YouTube ainda não tenha carregado o módulo de legendas
  }
}

// Obtém a duração real da mídia diretamente da instância ou do provedor embutido
function obterDuracaoReal(instancia: Plyr): number {
  if (instancia.duration && Number.isFinite(instancia.duration) && instancia.duration > 0) {
    return instancia.duration
  }
  const embed = (instancia as unknown as { embed?: { getDuration?: () => number } }).embed
  if (embed && typeof embed.getDuration === 'function') {
    const duracaoEmbed = embed.getDuration()
    if (duracaoEmbed && Number.isFinite(duracaoEmbed) && duracaoEmbed > 0) {
      return duracaoEmbed
    }
  }
  const media = (instancia as unknown as { media?: HTMLMediaElement }).media
  if (media && Number.isFinite(media.duration) && media.duration > 0) {
    return media.duration
  }
  return 0
}

// Aplica o novo tempo de reprodução na mídia ativa e atualiza a barra visualmente
function aplicarTempoVideo(instancia: Plyr, tempoAlvo: number, duracaoTotal: number) {
  const tempoLimitado = Math.max(0, Math.min(tempoAlvo, duracaoTotal))

  const embed = (instancia as unknown as { embed?: { seekTo?: (segundos: number, allowSeekAhead: boolean) => void } }).embed
  if (instancia.provider === 'youtube' && embed && typeof embed.seekTo === 'function') {
    embed.seekTo(tempoLimitado, true)
  }

  instancia.currentTime = tempoLimitado

  const inputSeek = containerRef.value?.querySelector('input[data-plyr="seek"]') as HTMLInputElement | null
  if (inputSeek && duracaoTotal > 0) {
    const porcentagem = (tempoLimitado / duracaoTotal) * 100
    inputSeek.value = String(porcentagem)
    inputSeek.style.setProperty('--value', `${porcentagem}%`)
  }
}

// Vincula eventos diretos de ponteiro na barra de progresso para garantir que o clique pule o vídeo
function vincularControleBarraProgresso(instancia: Plyr) {
  if (limparOuvintesBarra) {
    limparOuvintesBarra()
    limparOuvintesBarra = null
  }

  const inputSeek = containerRef.value?.querySelector('input[data-plyr="seek"]') as HTMLInputElement | null
  if (!inputSeek) return

  let arrastando = false

  const calcularEIrParaPosicao = (evento: MouseEvent | PointerEvent) => {
    const duracao = obterDuracaoReal(instancia)
    if (duracao <= 0) return

    const retangulo = inputSeek.getBoundingClientRect()
    if (retangulo.width <= 0) return

    const posicaoX = Math.max(0, Math.min(evento.clientX - retangulo.left, retangulo.width))
    const proporcao = posicaoX / retangulo.width
    const novoTempo = proporcao * duracao

    aplicarTempoVideo(instancia, novoTempo, duracao)
  }

  const aoPressionarPonteiro = (evento: PointerEvent) => {
    arrastando = true
    calcularEIrParaPosicao(evento)
  }

  const aoMoverPonteiro = (evento: PointerEvent) => {
    if (!arrastando) return
    calcularEIrParaPosicao(evento)
  }

  const aoSoltarPonteiro = () => {
    arrastando = false
  }

  inputSeek.addEventListener('pointerdown', aoPressionarPonteiro, { capture: true })
  window.addEventListener('pointermove', aoMoverPonteiro)
  window.addEventListener('pointerup', aoSoltarPonteiro)

  limparOuvintesBarra = () => {
    inputSeek.removeEventListener('pointerdown', aoPressionarPonteiro, { capture: true })
    window.removeEventListener('pointermove', aoMoverPonteiro)
    window.removeEventListener('pointerup', aoSoltarPonteiro)
  }
}

// Registra os ouvintes de eventos principais na instância do Plyr
function registrarEventos(instancia: Plyr) {
  instancia.on('ready', () => {
    isReady.value = true
    definirEstadoLoading(false)
    desativarLegendasYouTube(instancia)
    vincularControleBarraProgresso(instancia)
    emit('ready', instancia)
  })

  instancia.on('loadedmetadata', () => {
    desativarLegendasYouTube(instancia)
    vincularControleBarraProgresso(instancia)
  })

  instancia.on('play', (event) => {
    isPlaying.value = true
    desativarLegendasYouTube(instancia)
    emit('play', event)
  })

  instancia.on('playing', () => {
    desativarLegendasYouTube(instancia)
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

  const instancia = markRaw(new Plyr(elementoAlvo, opcoesMescladas.value))
  player.value = instancia
  registrarEventos(instancia)

  const possuiEmbedNativo = Boolean(elementoAlvo.getAttribute('data-plyr-embed-id'))
  if (fonteResolvida.value && !possuiEmbedNativo) {
    instancia.source = fonteResolvida.value
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
  if (limparOuvintesBarra) {
    limparOuvintesBarra()
    limparOuvintesBarra = null
  }
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
          :data-plyr-embed-id="tagElementoPadrao === 'div' ? idVideoLimpo || undefined : undefined"
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
  opacity: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}

.vue-plyr-container .plyr--youtube .plyr__video-embed {
  overflow: hidden !important;
  background-color: #000 !important;
}

.vue-plyr-container .plyr--youtube .plyr__video-embed iframe {
  pointer-events: none !important;
  top: 0 !important;
  left: -300% !important;
  width: 700% !important;
  height: 100% !important;
}

.vue-plyr-container .plyr--youtube .plyr__captions,
.vue-plyr-container .plyr--youtube [data-plyr='captions'] {
  display: none !important;
}

.vue-plyr-container .plyr__video-wrapper video {
  object-fit: contain !important;
}

.vue-plyr-container .plyr__controls {
  z-index: 3 !important;
  pointer-events: auto !important;
}

.vue-plyr-container .plyr__progress input[type='range'] {
  cursor: pointer;
  pointer-events: auto !important;
}

.vue-plyr-loading-overlay {
  aspect-ratio: 16 / 9;
  z-index: 2;
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