# apps/experiencias/exp02ef1b — O Enigma da Capa da Rádio (2º ano EF, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp02ef1b` · 2EF (unidade 1) · `telemetria, progresso` · `permissoes: ["forms"]` · 375×812 |
| Dev | `pnpm --filter @edu/exp02ef1b dev` → **:5187** (`strictPort`) · hub `/exp/exp02ef1b` ou `/dev-embed?src=http://localhost:5187` |
| DS | UMA seção: `unoovista` (`@edu/ui/ds-unoovista` + `unoovista.css` + `fonts/unoovista.css`) |
| api | módulo `enigma-capa` (`apps/api/src/enigma-capa/`, prefixo `/enigma-capa`, tabelas `exp02ef1b_*`, ADR-184) |
| Versão | `2.0.0` nos três lugares (`public/experiencia.json`, `package.json`, `EXP_VERSION` em `src/lib/tipos.ts`) |

A criança (7–8 anos) lê a missão no mural da @radio_escola ("ENCONTRE NAS
FOTOS 2 OBJETOS DA BIBLIOTECA"), acha os dois objetos do fundo com a lupa (o
anel enche em 3 s), publica UMA capa (foto em moldura fixa + selo — o LATCH 1),
lê a resposta da visitante, espera o professor, e na virada descobre que as
duas fotos eram o MESMO lugar: os objetos iguais nas duas fotos, o slider de
comparação que parte do centro, e o alfinete no que ficou fora. Depois, pares
e segunda foto (E5); o "Colocar no álbum" conclui.

**Desde a 2.0.0 (ADR-186) a tela segue o protótipo validado pelo time**
(`artefatos_exp02ef1b/design/08-prototipo.html`), sem a etapa 6. Toda tela diz
no alto o que fazer AGORA (título, frase curta, contador), sem dizer onde está
a resposta; os avisos do protótipo ("OLHE O FUNDO", "CAPA PUBLICADA!",
"AGUARDE O PROFESSOR", "FOTO GUARDADA NO ÁLBUM!") são o `BottomSheet` modal da
seção (`componentes/Aviso.tsx`), só com ícone e mensagem.

## O que quebra se você não souber

- **O passo vem do SERVIDOR** (`regras/passos.ts` da api, derivado dos
  carimbos e da fase da turma). A tela só escolhe quem o desenha (`App.tsx`).
  Dois estados locais seguram uma tela além do passo — e um F5 os pula de
  propósito: `publicada` (o aviso "CAPA PUBLICADA!" antes do feed) e
  `segurarFeed` (quem publica DEPOIS da virada vê a visitante 5 s antes da
  busca). A "cena completa" depois do slider é um terceiro, dentro da
  `Virada`.
- **A geometria é UMA imagem.** As duas fotos, a capa, a revelação e a cena
  inteira são JANELAS da mesma panorâmica 16:9, recortadas por CSS
  (`lib/geometria.ts`, `componentes/Janela.tsx`). Coordenadas em 0–100 da
  panorâmica; o `deslocamento` da moldura é FRAÇÃO da folga (0–1), nunca
  pixel. `retanguloVisivel` e `fraseDoFora` espelham a api — mudou lá, muda
  aqui. Os recortes e as molduras chegam em `sessao.geometria`: não duplique
  números.
- **A virada é GERAL da turma** (decisão do Lucas): o polling de 3 s do gate
  (`GET /enigma-capa/gate`) relê a sessão quando passo, fase, pacote ou rodada
  mudam. O zerar do professor (rodada+1) volta ao mural sozinho.
- **O gabarito não desce, e `src/contrato.test.ts` cobra**: os alvos dos dois
  objetos descem SÓ no passo da lupa (`estado.lupa.alvos` — o brilho e o anel
  precisam do lugar, ADR-186) e na E4 só depois da AJUDA (o pulso amarelo); sem núcleo, sem selo coerente, sem
  marcáveis, sem a atividade/cor das cartas. A tela manda o gesto (o ponto DA
  PANORÂMICA, o deslocamento) e desenha o que volta.
- **A lupa é medida aqui e decidida lá.** O cronômetro (`lib/lupa.ts`) soma o
  tempo com o centro da lente sobre CADA objeto (com folga de 1,25× o raio) e
  relata a cada 4 s e no AVANÇAR; o servidor guarda o máximo e limita ao tempo
  desde a entrada. O botão esmaecido continua TOCÁVEL: o toque antes do piso é a
  evidência (`lupa_alertas`) — "OLHE O FUNDO", a mãozinha e a vibração.
- **Fila de envio em MEMÓRIA** (`lib/fila.ts`), nunca `localStorage`: as
  jogadas (iniciar, publicar, slider, fora, pares, segunda foto)
  esperam a rede voltar com a faixa "SEM SINAL NA RÁDIO". Os toques dos
  invariantes NÃO entram na fila (cada um conta erro/acerto: a criança toca de
  novo). Um 409 relê o estado inteiro.
- **Textos**: os literais do PO estão em `lib/textos.ts` E na api
  (`TEXTOS` de `conteudo.ts`, que desce em `sessao.textos` já com espaço e
  hora). A tela usa o do servidor quando vem. Mudou copy? Os dois — e a e2e
  casa por texto exato.
- **Sem tela da escola.** A nomeação (ENQUADRAMENTO, AUTORIA, O QUE FICOU DE
  FORA) é ORAL, do professor. Por isso a seção `unooria` não entra no bundle.

## Compensações locais (pedidos abertos no storybook-unooria)

Todas marcadas no código com "(b) COMPENSAÇÃO local — pedido aberto no
storybook-unooria". Somem quando o pacote publicar a peça.

| Peça | Onde | A lacuna no DS |
|---|---|---|
| Janela (recorte por CSS + "CARREGANDO CAPA..." / "TENTAR DE NOVO") | `componentes/Janela.tsx` | o `PostCard.Media` só trata a imagem INTEIRA |
| Moldura de tamanho fixo (só desloca, sem zoom, clamp) | `componentes/MolduraFixa.tsx` | não há enquadramento na seção |
| Lupa circular 2× com o brilho e o anel do tempo de 3 s | `telas/Bancada.tsx` | não existe em seção alguma |
| Tela dividida + linhas douradas + slider de COMPARAÇÃO (alça no centro, `role="slider"`) + alfinete arrastável | `telas/Virada.tsx` | idem; e a seção não tem glifo de alfinete (o 📌 é emoji, como no protótipo) |
| Aviso de UMA ação | `componentes/Aviso.tsx` (o `BottomSheet` modal) | o `ConfirmDialog` tem sempre duas ações |
| Cartas de tamanho fixo arrastáveis | `telas/Explicar.tsx` | não há carta arrastável |
| O Bento só como balão (`MessageBubble` com o nome) | `componentes/Personagem.tsx` | não há arte dele; o retrato com iniciais saiu na 2.0.0 (parecia avatar do estudante) |
| Cor de celebração (dourado) e de ajuda (amarelo) | `estilos/globals.css` (`--exp-dourado`, `--exp-amarelo`) | a seção não publica essas cores |
| Alvo de toque de 56 px (anos iniciais) | `estilos/globals.css` (`--unv-touch-target`) | o token do pacote é 44 px |

## Desvios de layout, registrados

- **E2 em 375 px: as fotos ficam uma SOBRE a outra** (lado a lado só a partir
  de 600 px). Lado a lado, cada foto teria 170 px e a lente de 112 px cobriria
  meia foto.
- **"PUBLICAR CAPA" é o botão primário do Unoovista** (roxo), não verde: a
  seção não tem botão verde, e cor de ação é do DS.
- **O avanço da E2 chama-se "AVANÇAR"** (o PO não nomeou o botão).
