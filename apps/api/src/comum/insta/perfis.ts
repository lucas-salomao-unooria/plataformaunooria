import type { Perfil } from './defaults';

/**
 * Fichas operacionais dos 4 perfis de valores de Schwartz (doc 10 §3).
 *
 * Esta é a tradução da teoria em instrução de escrita: o que muda entre perfis é
 * **linguagem, ênfase e gancho — nunca o fato** (guardrail 3 do doc 05). São
 * quatro maneiras de contar a mesma coisa, e é exatamente o que uma plataforma
 * real faz com cada pessoa.
 *
 * A ficha entra no prompt de lote. Alterar um `oposto` aqui muda a ordem de
 * fallback do motor (doc 04 §5.5), porque o motor cai para o perfil vizinho
 * antes do oposto — não é só texto.
 */
export interface FichaDePerfil {
  /** Nome de exibição no painel do professor e no dossiê. */
  rotulo: string;
  /** Valores de Schwartz que o perfil agrega. */
  valores: string;
  /** O que prende a atenção de quem se move por esse valor. */
  prende: string;
  /** Vocabulário e bordões típicos. */
  vocabulario: string[];
  /** Forma narrativa que funciona. */
  narrativa: string;
  /** Ganchos emocionais permitidos (entram em `emotional_hook`). */
  ganchos: string[];
  /** Perfil oposto no círculo — conteúdo dele deve prender MENOS (doc 10 §3.5). */
  oposto: Perfil;
}

export const FICHAS: Record<Perfil, FichaDePerfil> = {
  abertura: {
    rotulo: 'Abertura à Mudança',
    valores: 'autodireção (pensar e escolher por conta própria) e estímulo (novidade, desafio)',
    prende:
      'descoberta, versão que ninguém contou, quebra de rotina, liberdade de tirar a própria conclusão',
    vocabulario: ['poucos sabem', 'e se', 'ninguém te contou', 'descobri', 'repensar', 'vira o jogo'],
    narrativa:
      'revelar um detalhe pouco conhecido que reabre a interpretação; convidar a duvidar da versão pronta',
    ganchos: ['curiosidade', 'misterio'],
    oposto: 'conservacao',
  },
  autotranscendencia: {
    rotulo: 'Autotranscendência',
    valores: 'universalismo (justiça, igualdade) e benevolência (cuidado com quem está perto)',
    prende: 'quem foi prejudicado, quem pagou a conta, cuidado, empatia, bem coletivo',
    vocabulario: [
      'quem sofreu com isso',
      'por trás disso tem gente',
      'justo',
      'ninguém fala de',
      'o preço que alguém pagou',
    ],
    narrativa:
      'deslocar o foco do feito para o efeito sobre pessoas e lugares; dar nome e rosto a quem ficou de fora da história oficial',
    ganchos: ['indignacao', 'pertencimento'],
    oposto: 'autopromocao',
  },
  autopromocao: {
    rotulo: 'Autopromoção',
    valores: 'realização (competência, sucesso) e poder (status, influência)',
    prende: 'mérito, competição, feito difícil, força, números que impressionam, quem venceu e por quê',
    vocabulario: [
      'recorde',
      'primeiro do mundo',
      'conseguiu o que ninguém',
      'estratégia',
      'dominou',
      'os números não mentem',
    ],
    narrativa: 'disputa com vencedor claro; a escala do feito ou da falha, medida em números',
    ganchos: ['admiracao', 'humor'],
    oposto: 'autotranscendencia',
  },
  conservacao: {
    rotulo: 'Conservação',
    valores: 'segurança (ordem, estabilidade), conformidade (respeito a regras) e tradição',
    prende: 'risco, ordem, autoridade reconhecida, herança, consequência de mexer no que funciona',
    vocabulario: [
      'sempre se soube',
      'os especialistas dizem',
      'consequência',
      'não é seguro',
      'foi construído com esforço',
      'cuidado com',
    ],
    narrativa: 'alerta apoiado em autoridade ou em precedente; defesa do que já está estabelecido',
    ganchos: ['cautela', 'pertencimento'],
    oposto: 'abertura',
  },
};

/**
 * Perfis vizinhos no círculo, em ordem de proximidade. O motor usa isto para
 * cair no vizinho antes do oposto quando a célula do perfil dominante esgota
 * (doc 04 §5.5) — descer para o oposto direto seria servir justamente o
 * conteúdo que prende menos.
 */
export function vizinhosDe(perfil: Perfil): Perfil[] {
  const oposto = FICHAS[perfil].oposto;
  return (Object.keys(FICHAS) as Perfil[]).filter(
    (candidato) => candidato !== perfil && candidato !== oposto,
  );
}

/** Ordem de fallback completa: o próprio, os dois vizinhos, o oposto por último. */
export function ordemDeFallback(perfil: Perfil): Perfil[] {
  return [perfil, ...vizinhosDe(perfil), FICHAS[perfil].oposto];
}

/** Bloco de instrução de escrita para o prompt de lote (doc 05 §3). */
export function blocoDeLinguagem(perfil: Perfil): string {
  const ficha = FICHAS[perfil];
  return [
    `PERFIL DE LINGUAGEM: ${ficha.rotulo}`,
    `Valores que movem quem lê: ${ficha.valores}.`,
    `O que prende a atenção dele: ${ficha.prende}.`,
    `Vocabulário e bordões a usar: ${ficha.vocabulario.join('; ')}.`,
    `Forma narrativa: ${ficha.narrativa}.`,
    `Ganchos emocionais permitidos (emotional_hook): ${ficha.ganchos.join(', ')}.`,
    '',
    'REGRA DURA: o perfil muda a LINGUAGEM, a ÊNFASE e o GANCHO — nunca o FATO.',
    `Um post deste perfil não pode contradizer um post de ${FICHAS[ficha.oposto].rotulo}`,
    'sobre o mesmo assunto: se um afirma algo que o outro nega, um dos dois inventou.',
    `Também é proibido depreciar quem se move por ${FICHAS[ficha.oposto].rotulo}:`,
    'escrever para um perfil não é atacar o perfil oposto.',
  ].join('\n');
}
