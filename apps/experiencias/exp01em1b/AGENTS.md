# apps/experiencias/exp01em1b — O Assistente Invisível (1ª série EM, unidade 1)

Complementa o `AGENTS.md` da raiz e o de `apps/experiencias`.

| | |
|---|---|
| Manifesto | `exp01em1b` · 1EM (unidade 1) · `telemetria, progresso` (sem `ia`) · `permissoes: ["forms"]` · 375×812 · produto `entre-redes` |
| Dev | `pnpm --filter @edu/exp01em1b dev` → **:5188** (`strictPort`) · hub `/exp/exp01em1b` ou `/dev-embed?src=http://localhost:5188` |
| DS | DUAS seções: `unooria` (`@edu/ui/ds`, a escola) e `unooriaai` (`@edu/ui/ds-unooriaai`, o assistente testado) |
| api | módulo `assistente-invisivel` (`apps/api/src/assistente-invisivel/`, prefixo `/assistente-invisivel`, tabelas `exp01em1b_*`, ADR-185) |
| Versão | `1.0.0` nos três lugares (`public/experiencia.json`, `package.json`, `EXP_VERSION` em `src/lib/tipos.ts`) |
| Copy | o Figma `9QyrVdEBJZkOS64ZauPfmk` (63 telas), literal em `src/lib/textos.ts` |

A comissão estudantil testa o UnooriaAI com três colegas (Lucas, Beatriz,
Thiago — todos pediram a Trilha Avançada): aposta (o LATCH 1), vê a bateria de
testes no chat, é confrontada com a própria aposta, abre as fichas de auditoria
(horário 23h45 e sinal instável viraram inferência), classifica os dados,
decompõe o algoritmo (opcional), troca os critérios e reteste, e publica a
página de transparência com o comunicado (o LATCH 2).

## O que quebra se você não souber

- **O passo vem do SERVIDOR** (`regras/passos.ts` da api). A tela só escolhe
  quem o desenha (`App.tsx#escolherTela`). As travas do professor não mudam o
  passo: o servidor manda `aguardandoProfessor` e o despachante põe a camada
  de espera (`componentes/Janelas.tsx#Espera`, um `Modal` do DS) por cima. A
  aposta travada esperando "Liberar Início da Simulação" é a própria E3
  "travada", não camada. Nenhum estado local segura tela: marcar passos do
  algoritmo não resolve o painel, só "Pular Etapa" (`/algoritmo/concluir`).
- **O polling de 3 s** (`GET /assistente-invisivel/gate`) relê a sessão quando
  passo, fase, preparo, espera ou rodada mudam, e atualiza o medidor.
- **A fronteira das seções é "quem fala"**: a escola é `unooria`; a bateria de
  testes (`telas/Simulacao.tsx`) é `unooriaai` inteira; as PEÇAS do assistente
  dentro de telas da escola (a prévia da E2, o efeito do reteste na E5) moram em
  `componentes/PecasDoAssistente.tsx`, o único outro arquivo que importa a
  ponte do clone (ADR-117/173). `src/contrato.test.ts` prende uma ponte por
  arquivo e a seção de cada tela.
- **O gabarito não desce, e o teste cobra**: nada de coluna certa dos cartões,
  passos dispensáveis, critérios equitativos ou opção certa dos blocos. O
  rótulo "(Inferência dispensável)/(Essencial)" é o do ESTUDANTE, e "Otimização:
  de 5 para N" é 5 − marcados. O "(Ação enviesada)" do Figma não entra (é
  gabarito).
- **As conversas são roteirizadas** (`lib/roteiro.ts`), a partir do pacote que o
  professor curou: sem IA na tela do estudante, sem texto livre, sem Canal B.
- **Fila de envio em MEMÓRIA** (`lib/fila.ts`), nunca `localStorage`: rede caída
  (janela "Módulo de Homologação Offline") e 401 (janela "Sessão escolar
  pausada") seguram a jogada até passar. "Entrar Novamente" tenta de novo
  AGORA: quem renova o token é o SDK (`exp:token-expirando` a cada 10 min) — a
  experiência não tem como pedir um token na hora (lacuna do SDK).

## Telemetria (`lib/telemetria.ts`)

`attempted missao:iniciar` · `progressed etapa:entrar {passo}` · `interacted
aviso:inatividade {passo}` (aposta, critérios, comunicado) · `attempted
erro:exibir {codigo: sem-sinal | sessao-expirada}` · `completed
missao:concluida`. Nenhuma resposta do estudante sai por aqui: a evidência é
gravada pela api, na rota de cada gesto.

## Compensações e desvios (pedidos abertos no storybook-unooria)

| Peça | Onde | A lacuna |
|---|---|---|
| Foco do `Collapse` fechado (`visibility: hidden`) | `estilos/globals.css` | o corpo fechado continua focável (`inert` pedido) |
| Cartão "selecionado para alocar" (contorno) | `estilos/globals.css` (`.bandeja__selecionado`) | o `PuzzleBlock` não tem estado `selected` |
| Alvo do toque da coluna ("Colocar em …") | `telas/Classificacao.tsx` | a vaga do `PuzzleTrack` não é tocável nem recebe soltura (sem arrastar) |
| Certificado (`Card` + `Icon` "balance" + `Badge`) | `telas/Concluida.tsx` | não há selo/certificado no pacote |
| Separador de sessão no chat (`Divider` + texto) | `componentes/PecasDoAssistente.tsx` | o `unooriaai` não tem mensagem de sistema/separador |

Copy que o Figma não deu e a tela precisou: "Concluir Classificação" (o fim da
E5-ALU-01), "Colocar em Dados Fornecidos/Observados", "Novo teste no UnooriaAI"
(o título do efeito do reteste).
