# exp-02-unootube — UnooTube

Clone educacional do YouTube Shorts sobre **fontes confiáveis vs. sensacionalismo**
(Entre Redes · 4º ano EF · unidade 1). Portado do projeto standalone `UnooTube`
(Next.js) para a estrutura de experiências da plataforma (Vite + `@edu/sdk`).

## A missão

1. O estudante abre um feed com 21 vídeos curtos de História (Grandes Navegações,
   escrita cuneiforme, arqueologia…). Metade tem fonte verificável e poucos
   inscritos; a outra metade é sensacionalista e tem "1 mil inscritos".
2. Ele salva **até 3** vídeos em que confiaria. Cada salvo muda o canal dele:
   fake dá +1000 inscritos, confiável dá +50 e conta 1 "fonte confiável".
3. Ao 3º salvo o **ranking da turma** desbloqueia — 39 colegas fictícios + o
   estudante, ordenados por inscritos: quem escolheu fake vence.
4. **"Adicionar credibilidade"** revela a coluna de fontes confiáveis e a
   métrica vira: *"Ter muitos inscritos não significa contar a verdade."*
   Esse clique é a conclusão (`exp.concluir({ score })`).

## O que é server-side (regra 3 do CLAUDE.md)

O gabarito (`factual`) e o estado da missão vivem em `apps/api/src/unootube`.
A experiência só recebe o catálogo sem gabarito e manda escolhas:

| Chamada | Quando |
|---|---|
| `GET /unootube/sessao` | boot (catálogo, estado, estudante, ranking se desbloqueado) |
| `POST /unootube/salvos {videoId}` / `POST /unootube/salvos/:id/remover` | salvar / remover |
| `POST /unootube/curtidos/:id` | curtir (toggle, sem efeito no jogo) |
| `GET /unootube/ranking` | abrir o ranking (409 `RANKING_BLOQUEADO` antes dos 3) |
| `POST /unootube/credibilidade` | conclusão — devolve `score` |
| `POST /unootube/reiniciar` | "Reiniciar missão" no perfil |

Após a credibilidade, salvar/remover devolvem 409 `MISSAO_CONCLUIDA` (o score
já foi reportado). Reiniciar descongela.

## Telemetria (canal analítico da SDK)

| verbo | objeto |
|---|---|
| `attempted` | `exp-02-unootube` (boot) |
| `interacted` | `comecar-missao`, `salvar:vNN`, `remover-salvo:vNN`, `curtir:vNN`, `descurtir:vNN`, `limite-atingido`, `concluir-missao`, `tela:playlists\|ranking\|perfil`, `descricao:vNN`, `som:on\|off`, `ordenar:inscritos\|confiaveis`, `busca-bloqueada`, `reiniciar` |
| `progressed` | `missao-3-salvos` com `resultado: { inscritos, fontesConfiaveis }` |
| `completed` | via `exp.concluir` em "Adicionar credibilidade" (`score = fontesConfiaveis`) |

Nenhum evento carrega se um vídeo é confiável — o cliente não sabe.

`missao-3-salvos` e `concluir-missao` não são a mesma coisa e é de propósito: o
primeiro marca o 3º salvo, o segundo marca a DECISÃO de fechar a missão. A
distância entre os dois é quanto tempo a criança passou revendo a escolha —
antes da 1.1.0 ela não existia, porque o 3º salvo abria o diálogo sozinho.

## Fluxo (1.1.0)

Entrada (briefing da missão) → feed → 3 favoritos na bandeja → "Concluir
missão" → diálogo → ranking → "Adicionar credibilidade" (a virada).

A tela de entrada só aparece com a missão zerada (`lib/missao.ts`): recarregar
no meio cai direto no feed. Reiniciar pelo perfil volta ao briefing.

## Vídeos (fora do git)

Os 21 mp4 (~52 MB, 10 s cada, 9:16) não são versionados (regra ">2 MB vai
para o bucket").

- **Dev**: copie-os para `public/videos/vNN.mp4` (pasta gitignorada) — o Vite
  serve em `./videos`. Origem: `~/Documents/UnooTube-projeto-completo/public/videos`.
- **Prod**: suba uma vez por contrato para
  `gs://{contrato}-assets/exp-02-unootube/videos/` e builde com
  `VITE_VIDEOS_BASE_URL=https://<cdn-assets>/exp-02-unootube/videos`
  (`docs/INFRA.md`).

## Rodar

```bash
pnpm --filter @edu/exp-02-unootube dev      # :5174 (a exp-01 usa :5173)
```

Logado no hub como estudante do 4º ano (`aluno4a01` / `unooria123` no seed), a
home é `/exp/exp-02-unootube`. Em dev o hub acha o Vite pela porta mapeada em
`apps/hub/lib/experiencias-dev.ts`. Sem `viewport` no manifesto: tela cheia.

## Interface

Vem do `@unooria/design-system` — não há CSS de aparência nesta experiência.
A divisão segue a REVELAÇÃO da missão, e não o arquivo (ver "Design System" no
CLAUDE.md da raiz):

| Tela | Ponte | Componentes |
|---|---|---|
| feed de Shorts | `@edu/ui/ds-unootube` | `ShortsPlayer` (vídeo real; `card` no desktop, `immersive` até 760px), `ShortsActionRail` |
| cromo | `@edu/ui/ds-unootube` | `TopBar`, `SearchBox`, `ProfileCompact`, `Sidebar`, `MobileTabBar` |
| playlists e canal | `@edu/ui/ds-unootube` | `TopMenuBar`, `ShortsShelf`, `ChannelHeader` (`showSubscribe={false}`), `EmptyState`, `Avatar`, `Button` |
| toast do app | `@edu/ui/ds-unootube` | `Snackbar` — fala de dentro da ficção, por isso NÃO é o da plataforma |
| **ranking e diálogos** | `@edu/ui/ds` | `SectionHeader`, `Table`, `MetricCard`, `Tabs`, `AlertBox`, `Modal`, `Tag` |

`main.tsx` importa QUATRO folhas: `unootube.css` + `fonts/unootube.css` (o
clone) e `unooria.css` + `fonts/unooria.css` (as telas da revelação). A folha de
fonte é linha separada desde a 0.1.17 e não é opcional — sem ela a tipografia
cai no fallback do sistema.

O `globals.css` guarda só três coisas, cada bloco marcado: o ESQUELETO (grade
da página e o carrossel com scroll-snap — o DS entrega o reprodutor, não o
carrossel), UMA COMPENSAÇÃO (o girador de carregamento) e as LIGAÇÕES de
encaixe. Zero hexadecimal. Toast, estado vazio, diálogo e tabela deixaram de ser
compensação na 0.1.17, quando a seção passou a publicá-los.

**Aparência clara/escura é escolha do estudante**, em Perfil → APARÊNCIA
(`src/lib/tema.ts`), lembrada em `localStorage`.

## Contrato com o smoke visual

`scripts/walkthrough-estudante-unootube.mjs` depende destes textos/seletores:
`.uni-topbar .uni-logo`, `article.short-item`,
`button[aria-label="Salvar vídeo"]`, `button[aria-label="Abrir seu perfil"]`,
`nav.uni-sidebar button` (Playlists/Ranking), `.library-preview video`,
"Sua coleção", "Missão concluída", "Adicionar credibilidade", as pílulas
"Claro"/"Escuro" e a frase "Ter muitos inscritos não significa contar a
verdade". Do ranking em diante os seletores são da seção da PLATAFORMA:
`h2` do `SectionHeader`, `.unooria-table tbody tr`,
`.unooria-metric-card__value`.

## Decisões

- URLs das fontes são **texto**, não link (sandbox do iframe bloqueia popups;
  estudantes não saem da plataforma).
- Colegas do ranking são **fictícios** (distribuição fixa para a lição; sem
  pontuação de colegas reais — LGPD).
- Sem Tailwind. O disfarce é YouTube e quem o desenha é a seção `unootube` do
  DS (2026-08-26): antes disso eram 523 linhas de CSS próprio em duas camadas,
  com 111 cores literais e nenhum tema escuro possível.
- O `ShortsPlayer` não mostra a faixa de canal pronta do DS (`showChannel`):
  ela traz um botão de INSCREVER-SE sempre visível, e nesta missão inscrever-se
  não existe — "inscritos" é o placar do estudante, não uma ação sobre o canal do
  vídeo. Um botão morto ali confundiria a métrica que a missão ensina a ler.
- O som é um item da trilha de ações, e não um botão sobre o vídeo: a seção não
  publica glifo de MUDO, então o estado aparece pelo realce de `active` e pelo
  rótulo ("Som"/"Mudo") em vez de por um glifo inventado.
- O `PhoneFrame` do DS NÃO é usado: quem desenha aparelho na plataforma é o hub
  (`DispositivoFrame`), e a exp-02 não declara `viewport` de propósito.
