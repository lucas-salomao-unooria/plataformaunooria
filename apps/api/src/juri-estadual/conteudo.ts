/**
 * O ESQUELETO fixo da exp06ef1b — o que não é gerado pelo professor: as peças
 * da regra (EF06CO03), o caso Mariana e os cinco cartões, e as perguntas da
 * plenária. Os quarenta estandes do banco padrão moram em `banco-padrao.ts`.
 *
 * O caso Mariana, os cartões e as perguntas são LITERAIS do banco de conteúdo
 * do PRD v2 (`dev/01e-banco-conteudo.md`, doc-exp06ef1b-03) e do Anexo
 * (one-pager §9). As peças da regra são da 0.6.0 (ADR-174, o Canal A puro),
 * escritas aqui e levadas ao PO no card da missão. Os cartões levam ids
 * opacos ao estudante (`m1`–`m3`, `t1`–`t2`) — os rótulos do 01e (M1, A1) não
 * descem.
 *
 * O que é GABARITO aqui (a peça certa, o cartão certo) nunca desce: o
 * estudante recebe os itens embaralhados pela sessão, com ids OPACOS, e quem
 * confere é o servidor.
 */

// -------------------------------------------- EF06CO03: a regra SE … ENTÃO

/**
 * As peças da regra que o programa do feed executou: três para o SE (a
 * condição) e três para o ENTÃO (a ação), uma certa em cada. Montar a regra é
 * o "construir o programa que implementa a solução" do texto oficial da
 * EF06CO03 — a cadeia de quatro blocos da 0.5.0 só pedia para reconhecer a
 * ordem.
 *
 * As erradas são equívocos de verdade sobre recomendação, não absurdos: o
 * perfil popular, o "adivinhou pela foto", o mais curtido da turma, o rodízio
 * neutro. "Ficar muito tempo" NÃO é distrator de propósito: o motor PESA a
 * permanência (`PESO_DA_PERMANENCIA`), e seria uma peça meio certa.
 */
export const PECAS_DO_SE = [
  { id: "se-curtir", texto: "o jurado curtir 2 ou mais posts do mesmo tema", certa: true },
  { id: "se-seguidores", texto: "o jurado tiver muitos seguidores", certa: false },
  { id: "se-foto", texto: "a foto de perfil do jurado mostrar um tema", certa: false },
] as const;

export const PECAS_DO_ENTAO = [
  { id: "entao-tema", texto: "mostrar mais projetos desse tema nas próximas posições", certa: true },
  { id: "entao-turma", texto: "mostrar os projetos mais curtidos pela turma inteira", certa: false },
  { id: "entao-rodizio", texto: "mostrar um projeto de cada tema, em rodízio", certa: false },
] as const;

export type PecaDaRegra = { readonly id: string; readonly texto: string; readonly certa: boolean };

// --------------------------------------------------- transferência: Mariana

export const CASO_MARIANA =
  "Na eleição para o Grêmio Estudantil da escola de Mariana, disputavam a Chapa A e a Chapa B. Mariana curtiu o primeiro vídeo que viu da Chapa A. Nos dias seguintes, o feed da rede dela só mostrava vídeos, propostas e eventos da Chapa A. Mariana foi votar dizendo para todos: 'A Chapa B nem tem projetos nem ninguém apoiando, é óbvio que a Chapa A já ganhou!'. Como você explicaria para Mariana o que realmente aconteceu com o feed dela?";

/**
 * Três cartões de MECANISMO e dois de ATITUDE, apresentados juntos e de forma
 * neutra; a criança escolhe um de cada. `certo` é gabarito e não desce. A
 * escolha é gravada para o professor e não vira nota.
 *
 * O `m1` tem 27 palavras e passa do teto de 25 dos cartões (RNF-USA-001): é a
 * redação literal aprovada pelo PO, e fica na lista de EXCEÇÕES NOMEADAS do
 * teste de invariantes (melhoria 5).
 */
export const CARTOES_DE_MECANISMO = [
  {
    id: "m1",
    certo: true,
    texto:
      "O aplicativo interpretou sua curtida como dado e usou um padrão para recomendar apenas a Chapa A, criando uma bolha que ocultou as postagens da Chapa B.",
  },
  {
    id: "m2",
    certo: false,
    texto: "A Chapa B foi banida ou não publicou nada porque sabia que iria perder a eleição.",
  },
  {
    id: "m3",
    certo: false,
    texto: "A rede social é dona da Chapa A e alterou as urnas e os celulares de propósito.",
  },
] as const;

export const CARTOES_DE_ATITUDE = [
  {
    id: "t1",
    certo: true,
    texto:
      "Buscar ativamente o perfil oficial da Chapa B e conversar diretamente com outros estudantes fora do feed automático antes de decidir o voto.",
  },
  {
    id: "t2",
    certo: false,
    texto: "Nunca mais curtir postagem nenhuma e deixar o aplicativo escolher o que quiser.",
  },
] as const;

export const IDS_DE_MECANISMO = CARTOES_DE_MECANISMO.map((c) => c.id);
export const IDS_DE_ATITUDE = CARTOES_DE_ATITUDE.map((c) => c.id);

// --------------------------------------------- a plenária (guia do professor)

/** As quatro perguntas do debate mediado — verbatim do Anexo (one-pager §9). */
export const PERGUNTAS_DA_PLENARIA = [
  "Quando vocês abriram o aplicativo, vocês sentiram que estavam vendo a feira inteira ou apenas uma parte dela?",
  "Olhem para a projeção da sala: como é possível que parte da turma tenha votado em robôs e outra parte em projetos de meio ambiente, se estávamos todos no mesmo aplicativo da mesma mostra?",
  "O que as nossas primeiras curtidas disseram para o algoritmo? Foi o sistema que 'adivinhou' ou fomos nós que demos o mapa do que ele deveria repetir?",
  "Se isso aconteceu numa feira escolar simulada, o que vocês acham que acontece nas redes sociais de verdade quando a gente curte apenas um tipo de notícia, opinião ou vídeo de influenciador?",
] as const;

// ------------------------------------------------ o teto de palavras (RNF-USA-001)

/** Teto dos cartões do caso Mariana (RNF-USA-001). */
export const MAX_PALAVRAS_DO_CARTAO = 25;

/**
 * Textos LITERAIS aprovados que passam do teto — melhoria 5: entram aqui, por
 * chave da copy, e o teste de invariantes os aceita pelo nome. Texto gerado por
 * IA continua barrado pela régua (`invariantes.ts`); esta lista não vale para ele.
 */
export const EXCECOES_DE_TETO: Readonly<Record<string, { palavras: number; motivo: string }>> = {
  "e6.cartao.mecanismo_correto": { palavras: 27, motivo: "redação literal do one-pager (§4, Pedido 6 do PO)" },
  "e1.narrativa.corpo_cracha": { palavras: 36, motivo: "crachá literal da copy revisada (vive na experiência)" },
};
