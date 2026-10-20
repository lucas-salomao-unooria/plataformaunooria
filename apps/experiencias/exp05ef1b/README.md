# exp05ef1b — Quem Mandou Isso? (v2.2)

5º ano EF, unidade 1, Entre Redes. Um grupo de WhatsApp simulado da "Turma 5ºB":
a Nina pede ajuda, o estudante lê oito mensagens (verdadeira/falsa ×
emocional/neutra) e encaminha EXATAMENTE três ao Mural da Turma, vota no motivo,
e só então o professor abre a revelação (crachás de veracidade e tom) e, no fim
do Mural revelado, o **alerta do grupo** (EF05CO03: quatro filtros com E/OU/NÃO,
executados e enviados ao grupo). Depois da síntese, na casca, o **robô do grupo**
(EF05CO04: blocos com laço, SE, ENTÃO e E DEPOIS, ligado em quatro mensagens e
enviado). Só Canal A: a evidência sai das ações (ADR-171, ADR-177).

## Rodar

```bash
pnpm --filter @edu/exp05ef1b dev     # :5184 (strictPort)
# no hub: /exp/exp05ef1b  (ou /dev-embed?src=http://localhost:5184)
```

A porta está no `CORS_ORIGINS` da api e no `docker-compose.dev.yml` (serviço
`exp05ef1b`, volume `nm-exp05ef1b`). Precisa de: a missão LIBERADA na turma
(ADR-69), o produto `entre-redes` ligado no painel da Unooria (ADR-87) e um
pacote APROVADO pelo professor para a turma — sem ele a lista de conversas fica
vazia, esperando.

## Onde as coisas estão

| O quê | Onde |
|---|---|
| Handshake, primeira leitura, falha de abertura | `src/bootstrap.tsx` |
| A máquina de telas, o polling, as ações e as falhas | `src/app/quem-mandou-app.tsx` |
| As telas do mensageiro (`@edu/ui/ds-unoochat`, tema claro) | `src/app/telas-do-clone.tsx` |
| As telas da casca (`@edu/ui/ds`) | `src/app/telas-da-escola.tsx` |
| O balão por formato e a mídia desenhada | `src/app/componentes/` |
| A tela da vez, o polling e a seleção (puro, testado) | `src/lib/regras.ts` |
| A copy da tela (literal do sheet) | `src/lib/textos.ts` |
| O contrato que a tela vê | `src/lib/tipos.ts` |
| Regras, gabarito e rotas | `apps/api/src/quem-mandou-isso/`, `apps/api/src/evidencias/` |

## Telemetria

`verbo:objeto` via `@edu/sdk`, com `resultado`/`contexto` como objetos — nunca
o `Então`, nome, e-mail ou o id de uma mensagem encaminhada.

| Verbo | Objeto | Quando | Carga |
|---|---|---|---|
| `attempted` | `missao:exp05ef1b` | tocou a conversa da Nina (uma vez) | — |
| `progressed` | `grupo:turma` | "Entrar no grupo" respondeu | — |
| `interacted` | `mensagem:encaminhar` | "Enviar" na folha "Encaminhar para..." | `contexto: { selecionadas }` |
| `scored` | `mural:selecao` | latch 1 ("Confirmar envio") | `resultado: { total }` |
| `scored` | `enquete:motivo` | latch 2 (o voto) | `resultado: { opcao }` (um dos 4 ids) |
| `progressed` | `gate:revelacao` · `gate:sintese` · `gate:reflexao` | a aba viu a fase aberta pelo professor | — |
| `interacted` | `alerta:execucao` | "Ver resultado" no alerta | `resultado: { pedido, n_execucao, n_resultados }` |
| `scored` | `alerta:envio` | "Enviar alerta ao grupo" | `resultado: { pedido }` |
| `interacted` | `robo:ligar` | "Ligar o robô" | `resultado: { n_ligacao, laco }` |
| `scored` | `robo:envio` | "Enviar meu robô" | `resultado: { n_ligacoes }` |
| `completed` | `missao:exp05ef1b` | `POST /concluir` respondeu (sai sozinho depois do robô) | — |

Nunca o filtro, os blocos nem quais mensagens passaram: só contagens. E o
`concluir()` do SDK, SEM `score`. Onde cada medida é LIDA: `exp05ef1b_sessoes`
(tempo no feed, seleção, motivo, os alertas, as ligações e o robô enviado) e a
evidência (E14) no painel do hub. `exp05ef1b_reflexoes` (o Se/Então de texto)
fica só pelo histórico (ADR-145).

## Histórico (saiu do `AGENTS.md` da pasta)

O que segue é o registro das versões; o que quebra sem aviso continua no
`AGENTS.md`.

### O mensageiro é o Unoochat, não o clone do WhatsApp (ADR-134, 0.3.0)

Até a 0.2.1 o clone era a seção `whatsappmobile` (só escuro, paleta do app
real). O Unoochat é cópia ESTRUTURAL dela — mesmos componentes, props e medidas
—, com a identidade da Unooria e dois temas; a missão usa o CLARO
(`data-unc-theme="light"` no `index.html`). O que a troca pediu, e o que morde
quem mexer depois:

- **A dependência do DS NA EXPERIÊNCIA** tem de ser `≥ 0.2.9`: a pasta resolve a
  própria cópia do pacote para as folhas de CSS, e a 0.2.8 que ela tinha não
  publica `unoochat.css` (o `@edu/ui` já estava na 0.2.11 — duas cópias).
- **A folha de fonte do clone é obrigatória**: o `Icon` do Unoochat é ligadura
  do Material Symbols, e sem `fonts/unoochat.css` o ícone vira o nome escrito.
- **Dois tokens sem par de nome**: `--wa-color-accent-badge` → `--unc-color-accent`
  (os acentos foram consolidados) e `--wa-color-text-meta` →
  `--unc-color-text-secondary`. O papel do comunicado era a INVERSÃO de dois
  tokens do tema escuro; no claro daria branco sobre lavanda, então é
  `surface-canvas` + `border-divider`.
- **A suíte casa por classe do DS** (`.unc-poll`, `.unc-forwardbutton`…):
  trocar de seção é trocar o prefixo nela também.
- O avatar de iniciais do `ChatHeader` não tem círculo visível (o fundo é o da
  barra) — já era assim no `whatsappmobile`; é do pacote.


### O grupo chega, a Nina tem rosto, e cada imagem tem cara (0.4.0)

Os pedidos visuais do PO de 2026-10-05:

- **As mensagens chegam uma a uma** (`useChegadaEmSequencia`, ~0,9 s cada:
  `MS_ENTRE_MENSAGENS` + `MS_DIGITANDO`). Só na PRIMEIRA abertura do grupo e
  com a seleção vazia (`grupoChegaEmSequencia`; `Vista.grupoChegou`): quem
  volta do Mural, ou dá F5 no meio da escolha, vê tudo de uma vez. Com
  `prefers-reduced-motion`, também. A e2e espera a OITAVA linha, nunca conta
  logo depois da primeira.
- **A foto da Nina é ilustração em SVG** (`src/assets/nina.svg`, importada
  pelo Vite e inlinada no bundle), em `avatarSrc` do `ChatListItem` e do
  `ChatHeader`. SVG é texto: a regra de "zero mídia binária" continua.
- **Cada imagem do grupo tem um desenho** (`estiloDaImagem`): comunicado,
  cartaz, print de tela ou bilhete, cada um com `alt` e proporção próprios.
  As duas imagens de um pacote saem sempre diferentes, e o par muda com o
  texto delas — o desenho não vira pista de veracidade entre turmas.
