# vendor/

Dependências locais. **O `index.html` não faz nenhuma requisição de rede** — abre com o cabo arrancado.

Isso existe porque o alvo de uso é sala de aula de escola pública. Enquanto o jogo carregava Three.js do `unpkg.com` e as fontes do `fonts.googleapis.com`, uma internet instável, um proxy ou um filtro de conteúdo deixavam a tela preta **sem nenhuma mensagem de erro** — e as fontes caíam em silêncio para uma fonte de sistema, quebrando todo o alinhamento pixelado.

## Conteúdo

| arquivo | origem | tamanho |
|---|---|---|
| `three.min.js` | `unpkg.com/three@0.128.0/build/three.min.js` | 590 KB |
| `PointerLockControls.js` | `unpkg.com/three@0.128.0/examples/js/controls/PointerLockControls.js` | 3,5 KB |
| `fonts.css` | escrito à mão, substitui o CSS do Google Fonts | 2 KB |
| `fonts/pressstart2p-latin*.woff2` | `fonts.gstatic.com` | 8 KB |
| `fonts/vt323-latin*.woff2` | `fonts.gstatic.com` | 14 KB |

Subsets `latin` e `latin-ext` apenas — cobrem todos os acentos do português. Os subsets cirílico e grego foram descartados.

## Copiar para uma máquina de sala

Copie a **pasta inteira**, não só o `index.html`. Sem `vendor/` ao lado, a tela fica preta de novo — o mesmo sintoma que isto veio resolver.

```
vila-do-lume/
  index.html
  vendor/
```

## Licenças

Three.js e PointerLockControls: MIT, Three.js Authors. Press Start 2P e VT323: SIL Open Font License 1.1. Todas permitem redistribuição junto com o projeto.

## Atualizar o Three.js

Não atualize sem necessidade: o código usa a API da r128, e a r15x removeu coisas que ele utiliza. Se atualizar mesmo assim, teste o ciclo completo — acender fogueira, pegar tocha, resgatar aldeão, cinemática final — porque nada disso tem teste automatizado.
