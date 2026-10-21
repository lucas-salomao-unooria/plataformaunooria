/**
 * A COPY DA REVELAÇÃO — as telas que derrubam o disfarce do Unoovista (dez
 * para quem fez o Raio-x, nove para quem não fez; ADR-167).
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ESTE ARQUIVO EXISTE DUAS VEZES, E AS DUAS CÓPIAS TÊM DE SER IDÊNTICAS.  ║
 * ║                                                                          ║
 * ║    apps/experiencias/exp08ef1b/src/lib/copy-da-revelacao.ts  ← v                                                                ║
 * ║    apps/hub/lib/insta/copy-da-revelacao.ts                                                                                                 ║
 * ║                                                                          ║
 * ║  Mexeu na copy? Mexa NAS DUAS, no mesmo commit. Nada no build cobra       ║
 * ║  isso — nem o typecheck, nem o lint, nem teste nenhum.                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Por que há duas cópias: o mesmo texto precisa aparecer em dois BUNDLES
 * diferentes — o da experiência (Vite, estático, no bucket) e o do hub (Next,
 * Cloud Run). Esta cópia é a que o ESTUDANTE lê, no meio da aula.
 *
 * Não passa pela api de propósito. A revelação abre no meio da aula, e rede
 * instável na escola é regra, não exceção: texto que depende de fetch é texto
 * que pode não aparecer. Ele viaja no bundle, como sempre viajou.
 *
 * Isto já foi um pacote de workspace (`@edu/conteudo-exp08ef1b`), que garantia a
 * igualdade por construção. Foi desfeito por decisão de 2026-09-09: a copy está
 * fechada e não haverá revisão dela. Se essa premissa mudar, a duplicação volta
 * a ser o risco que o pacote existia para eliminar.
 */

export interface TelaDaRevelacao {
  texto: string;
  destaque?: string;
  complemento?: string;
  /**
   * A PONTE DO RAIO-X: a tela mostra, embaixo do texto, os 6 posts do Raio-x
   * com de onde cada um veio — a devolutiva que o envio não deu (ADR-167).
   */
  ponte?: true;
}

/** De onde veio o lado em que o feed do estudante nasceu. */
export type OrigemDoLado = 'perfil' | 'redistribuido' | 'sorteio';

/**
 * As quatro primeiras. Uma ideia por tela, fundo escuro, tipografia grande e
 * transições lentas — a tela inteira sinaliza "saímos do jogo". O tom nunca
 * humilha: o sujeito da frase é o SISTEMA, nunca o estudante.
 */
export const REVELACAO_FIXA: TelaDaRevelacao[] = [
  {
    texto: 'O Unoovista não é uma rede social de verdade. É uma simulação.',
    complemento: 'Nenhum dado seu foi para rede social nenhuma.',
  },
  { texto: 'Mas uma coisa aqui era 100% real:', destaque: 'o algoritmo.' },
  {
    texto: 'Enquanto você navegava, ele aprendia',
    destaque: 'cada segundo',
    complemento: 'que você parava em cada post. Cada curtida. Cada comentário aberto.',
  },
  { texto: 'E com isso, ele escolheu', destaque: 'o que você viu — e o que você nunca viu.' },
];

/**
 * A PONTE DO RAIO-X — só para quem enviou o 6a, logo depois das quatro fixas.
 * Embaixo do texto, a lista dos 6 posts, cada um com "escrito para defender
 * [lado]" ou "escrito para informar, sem defender lado". Nenhum certo ou
 * errado, nenhuma contagem: a devolutiva fala do post, nunca do estudante.
 */
export const PONTE_DO_RAIO_X: TelaDaRevelacao = {
  texto: 'Os 6 posts do Raio-x, antes do debate:',
  destaque: 'de onde cada um veio.',
  ponte: true,
};

/** Como a ponte nomeia a origem de cada post. */
export function origemDoPostNaPonte(origem: 'A' | 'B' | 'neutro', rotulos: { A: string; B: string }): string {
  return origem === 'neutro' ? 'escrito para informar, sem defender lado' : `escrito para defender ${rotulos[origem]}`;
}

/**
 * As duas telas sobre os termos e o registro. A tela não diz em qual cláusula
 * estava a regra: daria de graça parte do 6b, que vem logo depois.
 */
export const TELA_DOS_TERMOS: TelaDaRevelacao = {
  texto: 'Essas regras de escolha estavam escritas.',
  destaque: 'Nos termos de uso que você aceitou lá na entrada — que quase ninguém lê, nem adulto.',
  complemento:
    'Eles são escritos para ser aceitos, não para ser lidos. Daqui a pouco você volta a eles.',
};

export const TELA_DO_REGISTRO: TelaDaRevelacao = {
  texto: 'O Unoovista era uma simulação.',
  destaque: 'O registro, não.',
  complemento:
    'As curtidas, os salvamentos e o tempo em cada post foram registrados de verdade e usados para escolher os próximos posts. Só você e o seu professor veem esses dados.',
};

/**
 * Tela 5 — o lado semeado. A frase MUDA com a origem do lado: dizer "foi
 * escolhido a partir de como você jogou" para quem caiu no sorteio seria mentir
 * na única tela do exercício que existe para não mentir.
 */
export function telaDoLadoSemeado(origem: string): TelaDaRevelacao {
  if (origem === 'perfil') {
    return {
      texto: 'Tem mais: seu feed',
      destaque: 'já começou puxado para um dos dois lados.',
      complemento:
        'E não foi sorteio — foi escolhido a partir de como você jogou, antes de você abrir o Unoovista.',
    };
  }

  if (origem === 'redistribuido') {
    return {
      texto: 'Tem mais: seu feed',
      destaque: 'já começou puxado para um dos dois lados.',
      complemento:
        'O seu foi ajustado para a turma não ficar toda do mesmo lado — mas ninguém te avisou disso.',
    };
  }

  return {
    texto: 'Tem mais: seu feed',
    destaque: 'já começou puxado para um dos dois lados.',
    complemento: 'No seu caso o lado foi sorteado. Você não escolheu, e ninguém te avisou.',
  };
}

/**
 * Tela 6 — a linguagem. É **obrigatória**: usar o perfil de valores para
 * escolher como falar com o estudante e depois esconder que isso aconteceu seria
 * repetir exatamente o que o exercício critica.
 */
export const TELA_DA_LINGUAGEM: TelaDaRevelacao = {
  texto: 'E ele também escolheu',
  destaque: 'como falar com você.',
  complemento:
    'O mesmo argumento foi escrito de quatro jeitos diferentes; você recebeu mais o jeito que combina com o que te move.',
};

/** A última fecha sempre igual: o problema é do sistema, não do estudante. */
export const TELA_FINAL: TelaDaRevelacao = {
  texto: 'Isso acontece com todo mundo — inclusive com adultos.',
  complemento: 'É assim que as redes que você usa funcionam.',
};

/**
 * O roteiro completo para uma origem de lado, nesta ordem: as quatro fixas, a
 * ponte do Raio-x (só para quem o enviou), os termos, o registro, o lado de
 * partida, a linguagem e a final.
 */
export function telasDaRevelacao(origem: string, opcoes: { comPonte?: boolean } = {}): TelaDaRevelacao[] {
  return [
    ...REVELACAO_FIXA,
    ...(opcoes.comPonte ? [PONTE_DO_RAIO_X] : []),
    TELA_DOS_TERMOS,
    TELA_DO_REGISTRO,
    telaDoLadoSemeado(origem),
    TELA_DA_LINGUAGEM,
    TELA_FINAL,
  ];
}
