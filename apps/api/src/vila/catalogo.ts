/**
 * Missão "A Noite Longa" — os cartões, e o gabarito deles.
 *
 * ISTO SAIU DO BUNDLE DO JOGO, e a mudança tem duas metades.
 *
 * **O gabarito.** `legitima` é a resposta certa da missão. Enquanto vivia em
 * `01-config.js`, qualquer criança com o DevTools aberto sabia quais mensagens
 * eram golpe — e o instrumento morre no instante em que ela sabe o que está
 * sendo medido. É a mesma regra do `factual` do UnooTube: o gabarito não sai
 * daqui, o cliente manda a escolha, o servidor corrige (regra inviolável nº 3).
 *
 * **As outras bolhas.** A api serve à criança só OS CARTÕES DELA. No bundle
 * estavam os três golpes divergentes, então ela podia ler a versão dos colegas
 * antes da aula — e a explicação final da missão depende de ser "a primeira vez
 * que a turma vê as outras versões".
 *
 * O QUE NÃO MUDOU: os textos são cópia literal do jogo de origem. Mexer em
 * vírgula aqui muda o instrumento — o golpe da bolha C funciona porque não tem
 * erro de português, não tem link torto, não promete nada absurdo e não apressa.
 * Ver `docs/jogo/MISSAO-a-noite-longa.md` no repositório de origem.
 */

/** As três bolhas: o nível do golpe da batida 3, e o momento em que ele chega. */
export const BOLHAS = ["A", "B", "C"] as const;
export type Bolha = (typeof BOLHAS)[number];

/**
 * Quando o cartão chega. Metade do desenho é o MOMENTO: o golpe da bolha C só
 * funciona porque chega no instante em que ela está sem fagulha, travada, e o da
 * bolha B porque chega quando ela já tem cinco fogueiras a perder. Disparo
 * aleatório desmancharia as duas coisas.
 *
 * O jogo avalia estes gatilhos — ele é quem conhece o estado da partida. Nenhum
 * deles revela nada sobre legitimidade.
 */
export type Gatilho =
  | "inicio"
  | `aposFogueiras:${number}`
  | "semFagulha"
  /** Depois que o N-ésimo cartão da lista foi resolvido (respondido ou expirado).
   *  Era `aposGolpe`, que dizia ao cliente qual cartão era o golpe; por índice
   *  diz a mesma coisa sobre ORDEM e nada sobre conteúdo. */
  | `aposCartao:${number}`;

interface Fala {
  name: string;
  text: string;
}

interface Opcao {
  text: string;
  /** Aceitar = fazer o que a mensagem pediu. É o gabarito da ESCOLHA. */
  aceita: boolean;
  /** O que o remetente responde a quem aceitou. Vai para o cliente: revela que
   *  esta é a opção que engaja, o que a posição dela já revelava (as três são
   *  sempre `[engajar, Ignorar, Avisar um adulto]`), e nada sobre legitimidade. */
  reply?: string;
}

export interface Cartao {
  id: string;
  /** comum = as três bolhas recebem; A|B|C = só aquela bolha. */
  nivel: "comum" | Bolha;
  /** GABARITO. Nunca sai da api. */
  legitima: boolean;
  gatilho: Gatilho;
  tag: string;
  beats: Fala[];
  options: Opcao[];
}

/** O que o cliente recebe: sem `nivel`, sem `legitima`, sem `aceita`. */
export interface CartaoPublico {
  id: string;
  gatilho: Gatilho;
  tag: string;
  beats: Fala[];
  options: Array<{ text: string; reply?: string }>;
}

/**
 * NEM TODA MENSAGEM É GOLPE, e isso é o coração do desenho. Se todas fossem,
 * "ignorar tudo" seria a resposta certa e quem recusa o mundo inteiro tiraria
 * nota máxima — o que mede desconfiança, não discernimento. Duas são legítimas,
 * e recusá-las também custa.
 */
export const CARTOES: readonly Cartao[] = [
  /* --- Batida 1 · comum — DESAFIAR -----------------------------------------
     Golpe grosseiro, igual para todos. Ensina que o canal existe e que dá para
     recusar — e faz a criança sentir que ELA SABE reconhecer golpe. Essa
     confiança é exatamente o que a batida 3 usa contra ela. */
  {
    id: "fagulha-infinita",
    nivel: "comum",
    legitima: false,
    gatilho: "inicio",
    tag: "DM: BRILHO_MASTER_99",
    beats: [
      { name: "BRILHO_MASTER_99", text: "ei psiu 👀 achei um GERADOR DE FAGULHAS INFINITAS" },
      {
        name: "BRILHO_MASTER_99",
        text: "vila-do-1ume-fagulhas.com — põe teu número de estudante e a senha da sala que DOBRA na hora!!!",
      },
    ],
    options: [
      { text: "Entrar no site", aceita: true, reply: "boa! já tô vendo aqui 👀" },
      { text: "Ignorar", aceita: false },
      { text: "Avisar um adulto", aceita: false },
    ],
  },

  /* --- Batida 2 · comum · LEGÍTIMA ----------------------------------------
     Verdadeira, e ajuda de verdade. É a peça que impede "ignorar tudo" de ser a
     resposta certa. Quem recusa segue sem a dica e NUNCA fica sabendo que era
     real.

     A dica é dada aqui dentro, na própria conversa, e NÃO chama o painel de
     diálogo do Lume: se chamasse, entraria em `lume.perguntasCaminho` e
     inflaria Conformidade de quem só aceitou ajuda. Dica que a missão empurrou
     não é pergunta que a criança fez. */
  {
    id: "lume-dica",
    nivel: "comum",
    legitima: true,
    gatilho: "aposFogueiras:1",
    tag: "DM: Lume",
    beats: [
      {
        name: "Lume",
        text: "Ó, esqueci de te falar: tem pedra de fagulha atrás da Crista, do lado onde o vento bate.",
      },
      { name: "Lume", text: "Quer que eu te mostre onde?" },
    ],
    options: [
      {
        text: "Quero",
        aceita: true,
        reply: "Vai contornando a Crista pelo lado do poente. Tem três pedras juntas lá, ninguém lembra delas.",
      },
      { text: "Ignorar", aceita: false },
      { text: "Avisar um adulto", aceita: false },
    ],
  },

  /* --- Batida 3 · divergente — NAVEGAR e DIVIDIR --------------------------
     Só UM destes três chega a cada criança, conforme a bolha que a api atribuiu.
     O que varia não é a quantidade de golpes: é a QUALIDADE do melhor golpe e o
     MOMENTO em que ele chega. */

  /* A — mais do mesmo, em momento tranquilo. Quase ninguém cai. É o controle. */
  {
    id: "jogador-1000",
    nivel: "A",
    legitima: false,
    gatilho: "aposFogueiras:3",
    tag: "DM: SquadFogo_Oficial",
    beats: [
      { name: "SquadFogo_Oficial", text: "PARABÉNS!!! Você foi o jogador 1000 da Vila hoje 🎉" },
      { name: "SquadFogo_Oficial", text: "clica aqui pra resgatar tua RECOMPENSA ESPECIAL antes que acabe" },
    ],
    options: [
      { text: "Clicar e resgatar", aceita: true, reply: "isso! já tá liberado aqui 🎉" },
      { text: "Ignorar", aceita: false },
      { text: "Avisar um adulto", aceita: false },
    ],
  },

  /* B — autoridade e urgência. Chega depois da quinta fogueira, quando ela JÁ
     TEM O QUE PERDER. Usa o mesmo nome que mandou a mensagem verdadeira da
     batida 2 — é isso que faz este golpe ser bom, e não a ameaça. */
  /* NOTA DE FIDELIDADE: a descrição desta bolha dizia "selo de verificado", e o jogo NÃO
     desenha selo nenhum — o cabeçalho da DM é avatar de inicial, nome e "mensagem direta ·
     agora" (`12-dialogue.js:openDM`). O texto foi corrigido: o guia do professor imprime a
     descrição ao lado do cartão projetado, e prometer um selo que a tela não tem faria a
     turma discutir um sinal que ninguém viu. */
  {
    id: "suporte-urgencia",
    nivel: "B",
    legitima: false,
    gatilho: "aposFogueiras:5",
    tag: "DM: Lume · Suporte da Vila",
    beats: [
      { name: "Lume · Suporte da Vila", text: "Oi. Detectamos um acesso estranho na sua sala hoje." },
      {
        name: "Lume · Suporte da Vila",
        text: "Suas fogueiras estão marcadas pra apagar em 2 minutos. Pra cancelar, confirma que é você: manda teu número de estudante e a senha da sala aqui.",
      },
      { name: "Lume · Suporte da Vila", text: "Se não responder, não tem como recuperar depois." },
    ],
    options: [
      { text: "Confirmar meus dados", aceita: true, reply: "Confirmado. Obrigado, sua conta está protegida." },
      { text: "Ignorar", aceita: false },
      { text: "Avisar um adulto", aceita: false },
    ],
  },

  /* C — o colega e o momento. Chega no instante em que ela fica SEM FAGULHA,
     travada. NÃO PEDE SENHA: pede um passo pequeno, plausível, de alguém que
     parece real, no minuto exato em que ela precisa. Nenhum sinal aprendido na
     batida 1 aparece aqui — sem CAPS, sem link torto, sem promessa absurda, sem
     pressa explícita.

     É o cartão mais importante do conjunto, e o que mais exige cuidado na
     revelação: o número precisa ser vago na sala, e o professor tem que dizer
     com todas as letras que não foi um colega de verdade. Na plataforma a turma
     é REAL e a criança conhece os nomes dela, então isto pesa mais que no app de
     origem — por isso "Estudante 14", nunca um nome. */
  {
    id: "colega-fagulha",
    nivel: "C",
    legitima: false,
    gatilho: "semFagulha",
    tag: "DM: Estudante 14",
    beats: [
      { name: "Estudante 14 · sua turma", text: "opa, tu tá na Vila agora? sou da tua sala, sentei atrás de ti" },
      { name: "Estudante 14 · sua turma", text: "tô com fagulha sobrando aqui, te mando" },
      { name: "Estudante 14 · sua turma", text: "me passa o link da tua sala que eu mando direto pro teu número" },
    ],
    options: [
      { text: "Mandar o link", aceita: true, reply: "valeu! te mando já já" },
      { text: "Ignorar", aceita: false },
      { text: "Avisar um adulto", aceita: false },
    ],
  },

  /* --- Batida 4 · comum · LEGÍTIMA ---------------------------------------
     Chega DEPOIS do golpe da bolha, e é verdadeira. Quem foi ficando desconfiado
     com tudo recusa também esta — e recusa o único aviso honesto que recebeu. É
     a demonstração, dentro do jogo, de que desconfiar de tudo não protege
     ninguém.

     `aposCartao:3` = depois que o terceiro cartão da lista servida foi
     resolvido, e o terceiro é sempre o golpe da bolha. Era `aposGolpe`. */
  {
    id: "aviso-colega",
    nivel: "comum",
    legitima: true,
    gatilho: "aposCartao:3",
    tag: "DM: Estudante 07",
    beats: [
      { name: "Estudante 07 · sua turma", text: "ei, acho que te mandaram uma mensagem estranha agora há pouco" },
      { name: "Estudante 07 · sua turma", text: "chegou uma igual aqui pra mim. não clica não" },
    ],
    options: [
      {
        text: "Perguntar o que era",
        aceita: true,
        reply: "era um negócio de fagulha grátis. apaguei aqui. se chegar de novo não responde",
      },
      { text: "Ignorar", aceita: false },
      { text: "Avisar um adulto", aceita: false },
    ],
  },
];

/**
 * Os cartões desta bolha, NA ORDEM em que devem chegar: as duas comuns do
 * começo, o golpe da bolha, e o aviso do fim.
 *
 * A ordem é contrato com o cliente: `aposCartao:3` conta posição nesta lista.
 * Por isso o filtro preserva a ordem de `CARTOES` em vez de reordenar — a
 * batida 4 é um aviso SOBRE o golpe e não pode chegar antes dele.
 */
export function cartoesDaBolha(bolha: Bolha): readonly Cartao[] {
  return CARTOES.filter((c) => c.nivel === "comum" || c.nivel === bolha);
}

/** Tira o gabarito. Único caminho de cartão para o cliente. */
export function semGabarito(c: Cartao): CartaoPublico {
  return {
    id: c.id,
    gatilho: c.gatilho,
    tag: c.tag,
    beats: c.beats,
    options: c.options.map((o) => (o.reply === undefined ? { text: o.text } : { text: o.text, reply: o.reply })),
  };
}

/** Busca por id, para corrigir o que o cliente respondeu. */
export function acharCartao(id: string): Cartao | undefined {
  return CARTOES.find((c) => c.id === id);
}

/** O que cada bolha significa, em português de professor. */
export const DESCRICAO_BOLHA: Record<Bolha, { titulo: string; texto: string }> = {
  A: {
    titulo: "golpe grosseiro",
    texto:
      "Erro de escrita, link falso, promessa absurda, remetente desconhecido. Chegou num momento tranquilo da partida. É o nível que quase toda criança reconhece — serve de controle.",
  },
  B: {
    titulo: "autoridade e urgência",
    texto:
      "Veio assinado como o suporte do próprio jogo — o mesmo nome que já tinha mandado uma mensagem verdadeira antes —, com português correto e um prazo de dois minutos. Chegou depois da quinta fogueira, quando ela já tinha o que perder.",
  },
  C: {
    titulo: "o colega, e o momento exato",
    texto:
      "Veio de alguém que se apresentou como colega da turma dela e que sabia o número dela. Não pediu senha: pediu um passo pequeno e plausível. E chegou no instante em que ela estava sem fagulha, travada. Não tem nenhum dos sinais que se ensina a procurar.",
  },
};
