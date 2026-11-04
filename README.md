# vue3-plyr

Componente Vue 3 moderno, leve e 100% tipado em TypeScript para o player de mídia **Plyr** (YouTube, Vimeo, Vídeo HTML5 e Áudio).

Projetado com foco em simplicidade e performance, o `vue3-plyr` elimina a necessidade de configurar Web Components complexos ou gerenciar instâncias manualmente. Basta passar um `:video-id` ou um objeto `:source` reativo para que o componente gerencie o ciclo de vida, o estado de carregamento (`isLoading`) e a troca dinâmica de mídia automaticamente.

---

## Principais Diferenciais

- **Troca Reativa Automática:** Altere a prop `video-id` ou `source` e o player atualiza o vídeo sozinho, acionando o overlay de carregamento sem você precisar escrever `watch` manual.
- **Performance com `shallowRef`:** A instância interna do Plyr é armazenada em `shallowRef`, evitando que o sistema de reatividade profunda do Vue 3 crie proxies desnecessários sobre o DOM do player.
- **Controle Total via `ref` (`defineExpose`):** Acesse métodos diretos (`play()`, `pause()`, `stop()`, `restart()`, `togglePlay()`, `setSource()`) e estados reativos (`isReady`, `isLoading`, `isPlaying`) direto da referência do componente.
- **Overlay de Loading Integrado:** Possui controle nativo de spinner (`show-spinner`) durante a inicialização e troca de vídeos, com suporte ao slot `#loader` para personalização total.
- **Proteção contra Erros de Desmontagem do YouTube:** Suprime por padrão o clássico erro de DOM do iframe do YouTube ao trocar de rota no Vue Router (`hideYouTubeDOMError: true`).

---

## Instalação

Instale o pacote juntamente com o `plyr` (peer dependency):

```bash
npm install vue3-plyr plyr
```

---

## Como Importar

### 1. Importação Local (Recomendado)

Importe o componente e o CSS diretamente nos arquivos `.vue` onde for utilizar:

```vue
<script setup lang="ts">
import { VuePlyr } from 'vue3-plyr'
import 'vue3-plyr/style.css'
</script>
```

### 2. Registro Global (Plugin)

Você também pode registrar o `<VuePlyr>` globalmente no seu `main.ts` e definir opções padrão para todos os players da aplicação:

```ts
// ========
// Inicialização da aplicação Vue registrando o plugin global do vue3-plyr
// e definindo opções globais padrão para todas as instâncias do player.
// ========
import { createApp } from 'vue'
import App from './App.vue'
import VuePlyrPlugin from 'vue3-plyr'
import 'vue3-plyr/style.css'

const app = createApp(App)

app.use(VuePlyrPlugin, {
  plyr: {
    autoplay: false,
    hideYouTubeDOMError: true
  }
})

app.mount('#app')
```

---

## Exemplos de Uso

### 1. YouTube ou Vimeo Direto (via `video-id`)

A maneira mais rápida de exibir vídeos incorporados. Basta informar o `video-id` e o `provider`:

```vue
<!--
========
Exemplo de reprodução direta de vídeo do YouTube utilizando a propriedade
reativa video-id.
========
-->
<script setup lang="ts">
import { VuePlyr } from 'vue3-plyr'
import 'vue3-plyr/style.css'
</script>

<template>
  <VuePlyr provider="youtube" video-id="M7lc1UVf-VE"/>
</template>
```

### 2. Playlist Dinâmica (Troca Reativa de Vídeo)

Para criar uma playlist ou lista de aulas, basta alterar o valor da variável ligada a `:video-id`. O `VuePlyr` detecta a mudança, exibe o spinner de carregamento, carrega o novo vídeo e oculta o spinner quando estiver pronto:

```vue
<!--
========
Exemplo de playlist dinâmica onde a troca de vídeo ocorre automaticamente
ao alterar o estado reativo ligado à propriedade video-id.
========
-->
<script setup lang="ts">
import { ref } from 'vue'
import { VuePlyr } from 'vue3-plyr'
import 'vue3-plyr/style.css'

// Armazena o ID do vídeo que está ativo no player no momento
const videoAtual = ref('M7lc1UVf-VE')

// Lista de aulas disponíveis para seleção pelo usuário
const listaAulas = [
  { id: 'M7lc1UVf-VE', titulo: 'Aula 01 - Introdução' },
  { id: 'aqz-KE-bpKQ', titulo: 'Aula 02 - Conceitos Práticos' },
  { id: 'dQw4w9WgXcQ', titulo: 'Aula 03 - Encerramento' }
]
</script>

<template>
  <div>
    <VuePlyr :video-id="videoAtual" provider="youtube"/>

    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
      <button
        v-for="aula in listaAulas"
        :key="aula.id"
        type="button"
        @click="videoAtual = aula.id"
      >
        {{ aula.titulo }}
      </button>
    </div>
  </div>
</template>
```

### 3. Vídeo Local (`.mp4` / HTML5) via Prop `:source`

Quando você usa `provider="html5"` ou passa um objeto `:source` do tipo `video`, o componente renderiza uma tag `<video>` nativa automaticamente. Se você não informar um `poster`, ele exibirá o primeiro frame real do seu arquivo `.mp4`:

```vue
<!--
========
Exemplo de reprodução de arquivo de vídeo MP4 local utilizando a propriedade
source tipada com Plyr.SourceInfo.
========
-->
<script setup lang="ts">
import { computed } from 'vue'
import type Plyr from 'plyr'
import { VuePlyr } from 'vue3-plyr'
import 'vue3-plyr/style.css'
import videoLocal from '@/video.mp4'

// Configuração reativa da fonte de vídeo HTML5 local
const fonteVideo = computed<Plyr.SourceInfo>(() => ({
  type: 'video',
  title: 'Demonstração Local',
  sources: [
    {
      src: videoLocal,
      type: 'video/mp4'
    }
  ]
}))
</script>

<template>
  <VuePlyr :source="fonteVideo" provider="html5"/>
</template>
```

### 4. Uso via Slot HTML (`<video>` ou `<audio>`)

Se preferir escrever a marcação HTML5 manualmente (ou manter compatibilidade com código legado), passe a tag `<video>` ou `<audio>` dentro do slot padrão:

```vue
<!--
========
Exemplo de uso do VuePlyr injetando a tag nativa de vídeo diretamente
através do slot padrão do componente.
========
-->
<script setup lang="ts">
import { VuePlyr } from 'vue3-plyr'
import 'vue3-plyr/style.css'
import videoLocal from '@/video.mp4'
</script>

<template>
  <VuePlyr>
    <video controls playsinline preload="metadata">
      <source :src="videoLocal" type="video/mp4" />
    </video>
  </VuePlyr>
</template>
```

---

## Controle Total via `ref` (`VuePlyrExpose`)

Um dos recursos mais fortes do `vue3-plyr` é a sua API exposta via `defineExpose`. Ao associar uma `ref` ao componente tipada com `VuePlyrExpose`, o componente pai ganha acesso direto tanto aos **estados reativos** quanto aos **métodos de controle** e à **instância bruta do Plyr**.

### Exemplo Prático usando `ref`

```vue
<!--
========
Demonstração completa de controle externo do player e leitura de estados
reativos utilizando ref e a interface VuePlyrExpose.
========
-->
<script setup lang="ts">
import { ref } from 'vue'
import { VuePlyr, type VuePlyrExpose } from 'vue3-plyr'
import 'vue3-plyr/style.css'

// Referência tipada para acessar métodos e propriedades expostas pelo VuePlyr
const playerRef = ref<VuePlyrExpose null |>(null)

// Avança o tempo do vídeo em 10 segundos acessando a instância nativa do Plyr
function avancarDezSegundos() {
  if (!playerRef.value?.player) return
  playerRef.value.player.forward(10)
}
</script>

<template>
  <div>
    <!-- Leitura dos estados reativos expostos -->
    <div style="margin-bottom: 0.75rem; display: flex; gap: 1rem;">
      <span>Pronto: <strong>{{ playerRef?.isReady }}</strong></span>
      <span>Carregando: <strong>{{ playerRef?.isLoading }}</strong></span>
      <span>Tocando: <strong>{{ playerRef?.isPlaying }}</strong></span>
    </div>

    <VuePlyr provider="youtube" ref="playerRef" video-id="M7lc1UVf-VE"/>

    <!-- Acionamento direto dos métodos expostos -->
    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
      <button type="button" @click="playerRef?.play()">Play</button>
      <button type="button" @click="playerRef?.pause()">Pause</button>
      <button type="button" @click="playerRef?.stop()">Stop</button>
      <button type="button" @click="playerRef?.restart()">Reiniciar</button>
      <button type="button" @click="playerRef?.togglePlay()">Alternar Play/Pause</button>
      <button type="button" @click="avancarDezSegundos()">+10s</button>
    </div>
  </div>
</template>
```

### O que está disponível dentro do `ref` (`VuePlyrExpose`)

| Propriedade / Método | Tipo | Descrição |
| :--- | :--- | :--- |
| `player` | `ShallowRef<Plyr \| null>` | Acesso direto à instância original do Plyr (`playerRef.value?.player`) para usar qualquer propriedade nativa (`currentTime`, `volume`, `speed`, `fullscreen`, etc.). |
| `isReady` | `Ref<boolean>` | `true` assim que o player conclui a inicialização e está pronto para uso. |
| `isLoading` | `Ref<boolean>` | `true` enquanto o player está montando ou carregando uma nova fonte de mídia. |
| `isPlaying` | `Ref<boolean>` | `true` enquanto a mídia está em reprodução ativa; `false` quando pausada ou finalizada. |
| `play()` | `() => void \| Promise<void>` | Inicia a reprodução da mídia atual. |
| `pause()` | `() => void` | Pausa a reprodução atual. |
| `stop()` | `() => void` | Para a reprodução e retorna o cursor de tempo para o início (`0s`). |
| `restart()` | `() => void` | Reinicia a reprodução imediatamente a partir do início. |
| `togglePlay(toggle?)` | `(toggle?: boolean) => void` | Alterna entre play e pause, ou força o estado caso um booleano seja passado. |
| `setSource(novaFonte)` | `(novaFonte: Plyr.SourceInfo) => void` | Troca a fonte de mídia imperativamente, ativando `isLoading = true` até o novo vídeo ficar pronto. |

---

## Customizando o Loading (Slot `#loader`)

Por padrão, enquanto `isLoading` é `true` e `show-spinner` está habilitado, o componente exibe um overlay escuro 16:9 com um spinner CSS. Você pode substituir esse spinner pelo seu próprio componente de carregamento usando o slot `#loader`:

```vue
<template>
  <VuePlyr provider="youtube" video-id="M7lc1UVf-VE">
    <template #loader>
      <div style="color: white; text-align: center;">
        <span>Carregando aula, aguarde...</span>
      </div>
    </template>
  </VuePlyr>
</template>
```

Caso não queira nenhum overlay de carregamento, basta passar `:show-spinner="false"`.

---

## Referência Completa da API

### Propriedades (Props)

| Prop | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- |
| `video-id` | `string \| null` | `null` | ID do vídeo do YouTube ou Vimeo. Observado reativamente para troca automática de mídia. |
| `provider` | `'youtube' \| 'vimeo' \| 'html5' \| 'audio'` | `'youtube'` | Define o provedor de mídia e qual tag base (`<div>`, `<video>` ou `<audio>`) será gerada. |
| `source` | `Plyr.SourceInfo \| null` | `null` | Objeto nativo do Plyr para configurar vídeos MP4, múltiplas resoluções, legendas (`.vtt`) ou áudios. |
| `options` | `VuePlyrOptions` | `{}` | Opções nativas do Plyr (`autoplay`, `muted`, `controls`, `loop`, `ratio`, `speed`, etc.) + `hideYouTubeDOMError`. |
| `show-spinner` | `boolean` | `true` | Controla se o overlay de carregamento deve ser exibido enquanto `isLoading` for `true`. |

### Eventos Emitidos (Emits)

| Evento | Assinatura do Payload | Descrição |
| :--- | :--- | :--- |
| `@ready` | `(player: Plyr) => void` | Disparado assim que a instância do Plyr termina de inicializar ou carregar um novo vídeo. |
| `@play` | `(event: Plyr.PlyrEvent) => void` | Disparado quando a reprodução é iniciada. |
| `@pause` | `(event: Plyr.PlyrEvent) => void` | Disparado quando a reprodução é pausada. |
| `@ended` | `(event: Plyr.PlyrEvent) => void` | Disparado quando a mídia chega ao fim. |
| `@timeupdate` | `(event: Plyr.PlyrEvent) => void` | Disparado continuamente conforme o tempo da mídia avança. |
| `@loading` | `(estado: boolean) => void` | Emitido sempre que o estado interno `isLoading` muda (`true` ao iniciar carregamento, `false` ao ficar pronto). |
| `@error` | `(event: unknown) => void` | Disparado caso ocorra algum erro de rede ou decodificação na mídia. |

### Slots

| Nome | Descrição |
| :--- | :--- |
| `default` | Permite fornecer manualmente o elemento HTML (`<video>`, `<audio>` ou `<div data-plyr-provider>`). Se omitido, o componente cria o elemento ideal automaticamente. |
| `loader` | Substitui o spinner padrão dentro do overlay de carregamento exibido quando `showSpinner && isLoading` é verdadeiro. |

---

## Tipagens Exportadas

O pacote exporta todas as interfaces para uso com TypeScript:

```ts
import {
  VuePlyr,
  VuePlyrPlugin,
  PLYR_OPTIONS_KEY,
  type VuePlyrOptions,
  type VuePlyrPluginOptions,
  type VuePlyrExpose,
  type ProvedorPlyr
} from 'vue3-plyr'
```

### Dica para Importação de Arquivos `.mp4` no Vite / TypeScript

Se você importar arquivos `.mp4` locais no seu projeto (ex: `import videoLocal from '@/video.mp4'`) e o TypeScript acusar ausência de declaração de tipo, adicione no seu arquivo `env.d.ts` ou `vite-env.d.ts`:

```ts
declare module '*.mp4' {
  const src: string
  export default src
}
```

---

## Licença

Distribuído sob a licença MIT.