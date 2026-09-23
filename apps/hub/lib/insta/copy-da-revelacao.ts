/**
 * A COPY DA REVELAÇÃO — as sete telas que derrubam o disfarce do Instanooria.
 *
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ESTE ARQUIVO EXISTE DUAS VEZES, E AS DUAS CÓPIAS TÊM DE SER IDÊNTICAS.  ║
 * ║                                                                          ║
 * ║    apps/hub/lib/insta/copy-da-revelacao.ts  ← você está aqui                                                                             ║
 * ║    apps/experiencias/exp08ef1b/src/lib/copy-da-revelacao.ts                                                                       ║
 * ║                                                                          ║
 * ║  Mexeu na copy? Mexa NAS DUAS, no mesmo commit. Nada no build cobra       ║
 * ║  isso — nem o typecheck, nem o lint, nem teste nenhum.                    ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Por que há duas cópias: o mesmo texto precisa aparecer em dois BUNDLES
 * diferentes — o da experiência (Vite, estático, no bucket) e o do hub (Next,
 * Cloud Run). Esta cópia é a que o PROFESSOR lê no guia da aula, antes dela.
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
    texto: 'O Instanooria não é uma rede social de verdade. É uma simulação.',
    complemento: 'Nenhum dado seu saiu daqui.',
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
        'E não foi sorteio — foi escolhido a partir de como você jogou, antes de você abrir o Instanooria.',
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

/** O roteiro completo para uma origem de lado. Sete telas, nesta ordem. */
export function telasDaRevelacao(origem: string): TelaDaRevelacao[] {
  return [...REVELACAO_FIXA, telaDoLadoSemeado(origem), TELA_DA_LINGUAGEM, TELA_FINAL];
}
