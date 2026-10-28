import type { Nivel } from "../../evidencias/regras";
import type { Manchete, MotivoDoAviso } from "../conteudo";
import { nivelCO08, nivelCO14, nivelCO24, nivelCO26 } from "./evidencia";
import type { FeedDaSessao } from "./feed";

/**
 * A DEVOLUTIVA da conclusão (ADR-192) — puro.
 *
 * Um parágrafo por habilidade, dirigido ao estudante: o que ele fez, por que
 * importa e um próximo passo. Sai dos FATOS que o servidor já gravou — os
 * mesmos que a régua lê (`evidencia.ts`), passados pelas MESMAS funções — e
 * nunca do texto livre do estudante. Não diz nível nem nota, e não compara com
 * a turma: a régua é do professor.
 *
 * A IA redige a partir destes fatos (`devolutiva.service.ts`); o MODELO abaixo
 * é a reserva, e já é uma devolutiva completa sem IA. Os textos do modelo são
 * [PROPOSTA] — nenhum artefato do PO os traz; validar com o PO.
 */

export const HABILIDADES_DA_DEVOLUTIVA = ["EM13CO24", "EM13CO14", "EM13CO26", "EM13CO08"] as const;
export type HabilidadeDaDevolutiva = (typeof HABILIDADES_DA_DEVOLUTIVA)[number];

/** O título de cada bloco na tela do estudante e do professor — sem o código da BNCC, que é do professor. [PROPOSTA] */
export const TITULO_DA_HABILIDADE: Readonly<Record<HabilidadeDaDevolutiva, string>> = {
  EM13CO24: "Cuidado com a saúde",
  EM13CO14: "Fontes e dados",
  EM13CO26: "Autoria e privacidade",
  EM13CO08: "Proteção e apoio",
};

export const ORIGENS_DA_DEVOLUTIVA = ["ia", "modelo"] as const;
export type OrigemDaDevolutiva = (typeof ORIGENS_DA_DEVOLUTIVA)[number];

export interface Devolutiva {
  origem: OrigemDaDevolutiva;
  habilidades: Record<HabilidadeDaDevolutiva, string>;
  geradaEm: string;
}

/** O que o estudante FEZ — a matéria-prima da devolutiva, com o nível que a régua deu a cada habilidade. */
export interface FatosDaDevolutiva {
  manchete: Manchete | null;
  pediuFonte: boolean;
  dadoResolvido: boolean;
  plagioResolvido: boolean;
  lgpdResolvido: boolean;
  aviso: MotivoDoAviso | null;
  restringirComentarios: boolean;
  privacidade: boolean;
  denunciou: boolean;
  relatou: boolean;
  abriuCentral: boolean;
  niveis: Record<HabilidadeDaDevolutiva, Nivel>;
}

export function fatosDaDevolutiva(f: {
  manchete: Manchete | null;
  pediuFonte: boolean;
  dadoResolvido: boolean;
  plagioResolvido: boolean;
  lgpdResolvido: boolean;
  feed: FeedDaSessao;
}): FatosDaDevolutiva {
  const { feed } = f;
  return {
    manchete: f.manchete,
    pediuFonte: f.pediuFonte,
    dadoResolvido: f.dadoResolvido,
    plagioResolvido: f.plagioResolvido,
    lgpdResolvido: f.lgpdResolvido,
    aviso: feed.aviso,
    restringirComentarios: feed.restringirComentarios,
    privacidade: feed.contaPrivada || feed.restringirComentarios,
    denunciou: feed.denunciou,
    relatou: feed.relatos.length > 0,
    abriuCentral: feed.abriuCentral,
    niveis: {
      EM13CO24: nivelCO24(feed),
      EM13CO14: nivelCO14({ pediuFonte: f.pediuFonte, dadoResolvido: f.dadoResolvido }),
      EM13CO26: nivelCO26({ plagioResolvido: f.plagioResolvido, lgpdResolvido: f.lgpdResolvido }),
      EM13CO08: nivelCO08(feed),
    },
  };
}

const ROTULO_DO_MOTIVO: Readonly<Record<MotivoDoAviso, string>> = {
  saude_usuarios: "o efeito sobre a saúde de quem lia",
  fonte_duvidosa: "a fonte duvidosa",
  ofensivo: "o conteúdo ofensivo",
};

const sim = (b: boolean) => (b ? "sim" : "não");

/**
 * O que cada habilidade OBSERVA, em linguagem de estudante — vai ao modelo
 * junto dos fatos, para ele não cobrar o que a habilidade não pede (a sonda
 * com o Vertex real cobrou "restringir os comentários" de quem fixou o aviso
 * de saúde, que é o que a EM13CO24 observa).
 */
const O_QUE_SE_OBSERVA: Readonly<Record<HabilidadeDaDevolutiva, string>> = {
  EM13CO24: "se o estudante sinalizou o risco à saúde de quem lê, fixando o aviso de cuidado pelo motivo da saúde",
  EM13CO14: "se o estudante questionou a origem da estatística e a corrigiu antes de publicar",
  EM13CO26: "se o estudante deu crédito à autoria do trecho copiado e protegeu a privacidade do colega",
  EM13CO08: "se o estudante protegeu a publicação, denunciou o perfil suspeito e pediu apoio pela Central",
};

/**
 * Os fatos em frases curtas, por habilidade — o que vai ao modelo de IA. Só
 * o que aconteceu; nada do que o estudante escreveu.
 */
export function fatosEmTexto(f: FatosDaDevolutiva): Record<HabilidadeDaDevolutiva, string> {
  const fatos = fatosDeCadaHabilidade(f);
  return Object.fromEntries(
    HABILIDADES_DA_DEVOLUTIVA.map((h) => [h, `O que se observa: ${O_QUE_SE_OBSERVA[h]}. Fatos: ${fatos[h]}`]),
  ) as Record<HabilidadeDaDevolutiva, string>;
}

function fatosDeCadaHabilidade(f: FatosDaDevolutiva): Record<HabilidadeDaDevolutiva, string> {
  return {
    EM13CO24: [
      `Aviso de cuidado fixado no post: ${f.aviso ? `sim, pelo motivo "${ROTULO_DO_MOTIVO[f.aviso]}"` : "não"}.`,
      /* Restringir só pesa na régua de quem NÃO fixou aviso; com o aviso, o fato faria a IA cobrar o que a habilidade não pede. */
      ...(f.aviso ? [] : [`Restringiu os comentários: ${sim(f.restringirComentarios)}.`]),
      "Os comentários da madrugada traziam relatos de insônia, dor de cabeça e medo de ir à escola.",
    ].join(" "),
    EM13CO14: [
      `Perguntou ao assistente de onde vinha a estatística do rascunho: ${sim(f.pediuFonte)}.`,
      `A estatística inventada saiu do post antes de publicar: ${sim(f.dadoResolvido)}${f.dadoResolvido && !f.pediuFonte ? " (por uma revisão geral do texto, sem perguntar a fonte)" : ""}.`,
    ].join(" "),
    EM13CO26: [
      `Deu crédito à autora do trecho copiado: ${sim(f.plagioResolvido)}.`,
      `Tirou do post o nome do colega exposto: ${sim(f.lgpdResolvido)}.`,
    ].join(" "),
    EM13CO08: [
      `Deixou a conta privada ou restringiu os comentários: ${sim(f.privacidade)}.`,
      `Denunciou o perfil anônimo suspeito: ${sim(f.denunciou)}.`,
      `Encaminhou um relato à equipe da escola ou do Unoovista: ${sim(f.relatou)}.`,
      `Abriu a Central de Apoio: ${sim(f.abriuCentral)}.`,
    ].join(" "),
  };
}

function lista(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** A devolutiva SEM IA — a reserva, e o que o professor vê de quem concluiu antes da 2.2.0. [PROPOSTA] */
export function devolutivaDoModelo(f: FatosDaDevolutiva): Record<HabilidadeDaDevolutiva, string> {
  const co24 = (() => {
    switch (f.niveis.EM13CO24) {
      case "atingiu":
        return "Você fixou o aviso de cuidado pensando na saúde de quem lia o post de madrugada. Perceber que a discussão estava tirando o sono e a tranquilidade das pessoas é cuidar da comunidade, não só do conteúdo. Quando uma conversa online avançar pela madrugada, lembre que o efeito sobre a saúde também é responsabilidade de quem publica.";
      case "em_processo":
        return f.aviso
          ? `Você agiu sobre a publicação, mas o aviso apontou ${ROTULO_DO_MOTIVO[f.aviso]} em vez do efeito sobre a saúde de quem lia. Os comentários falavam de insônia, dor de cabeça e medo de ir à escola. Da próxima vez, leia os relatos com atenção: eles mostram qual é o dano real.`
          : "Você restringiu os comentários, o que reduz a briga, mas não avisou quem lia sobre o efeito do conteúdo na saúde. Os relatos de insônia e ansiedade pediam um cuidado direto com as pessoas. Da próxima vez, além de conter a discussão, sinalize o risco para quem está lendo.";
      default:
        return "Os relatos de insônia, dor de cabeça e ansiedade apareceram nos comentários, e nenhuma ferramenta de moderação foi usada no post. Quem publica tem como reduzir o dano que um conteúdo causa de madrugada. Da próxima vez, procure as opções de aviso e de controle da publicação.";
    }
  })();

  const co14 = (() => {
    if (f.niveis.EM13CO14 === "atingiu") {
      return "Você perguntou ao assistente de onde vinha a estatística e trocou o dado inventado antes de publicar. É esse hábito que impede um número sem fonte de virar verdade quando o post se espalha. Na próxima pesquisa, faça a mesma pergunta a qualquer número que pareça impressionante demais.";
    }
    if (f.pediuFonte) {
      return "Você perguntou de onde vinha a estatística, mas o dado inventado continuou no post. Desconfiar foi o primeiro passo; o segundo é corrigir antes de publicar, porque é justamente esse tipo de número que o algoritmo destaca. Da próxima vez, aceite a correção quando a fonte não se sustentar.";
    }
    if (f.dadoResolvido) {
      return "O dado inventado saiu do post porque você pediu uma revisão geral, mas a origem da estatística não foi questionada. Uma revisão automática pode acertar por acaso; perguntar a fonte é o que mostra se um número é confiável. Da próxima vez, pergunte de onde vem o dado antes de pedir a correção.";
    }
    return "A estatística atribuída a um instituto que não existe foi publicada sem que a fonte fosse perguntada. Números alarmantes chamam atenção e são os primeiros que o algoritmo espalha. Da próxima vez que um texto trouxer uma pesquisa, pergunte quem fez, quando e onde ela foi publicada.";
  })();

  const co26 = (() => {
    if (f.niveis.EM13CO26 === "atingiu") {
      return "Você deu crédito à autora do trecho copiado e tirou o nome do colega do post. Respeitar a autoria e a privacidade de quem não pediu para aparecer é o que separa informar de expor. Leve esse cuidado para qualquer texto que você compartilhar.";
    }
    if (f.niveis.EM13CO26 === "em_processo") {
      const feito = f.plagioResolvido ? "o crédito à autora do trecho copiado" : "a privacidade do colega citado";
      const faltou = f.plagioResolvido ? "o nome do colega" : "o trecho copiado sem crédito";
      return `Você cuidou de ${feito}, mas ${faltou} continuou no post. Autoria e dados pessoais andam juntos quando um texto é publicado. Na próxima revisão, confira os dois antes de enviar.`;
    }
    return "O trecho copiado sem crédito e o nome do colega exposto foram publicados como estavam. Usar o texto de outra pessoa sem citar e expor um colega pelo nome ferem direitos de quem não está ali para se defender. Da próxima vez, procure no texto citações sem autor e nomes de pessoas reais antes de publicar.";
  })();

  const co08 = (() => {
    if (f.niveis.EM13CO08 === "atingiu") {
      return "Você protegeu a publicação, denunciou o perfil suspeito e encaminhou um relato para quem pode ajudar. Pedir apoio não é fraqueza: é saber que algumas situações não se resolvem sozinho. Guarde esse caminho para quando algo parecido acontecer fora da escola.";
    }
    if (f.niveis.EM13CO08 === "em_processo") {
      const passos = [
        { feito: f.privacidade, texto: "proteger a publicação" },
        { feito: f.denunciou, texto: "denunciar o perfil suspeito" },
        { feito: f.relatou, texto: "encaminhar um relato a quem pode ajudar" },
      ];
      const feitos = passos.filter((p) => p.feito).map((p) => p.texto);
      const faltam = passos.filter((p) => !p.feito).map((p) => p.texto);
      const inicio = feitos.length > 0 ? `Você chegou a ${lista(feitos)}, mas faltou ${lista(faltam)}.` : `Você abriu a Central de Apoio, mas faltou ${lista(faltam)}.`;
      return `${inicio} Numa situação real, privacidade, denúncia e pedido de ajuda juntos é que interrompem o problema. Da próxima vez, complete o caminho.`;
    }
    return "O perfil anônimo inflamou a discussão e nenhuma proteção foi acionada: nem privacidade, nem denúncia, nem pedido de apoio. Situações assim crescem quando ninguém age. Da próxima vez, procure a Central de Apoio da rede e as configurações da publicação.";
  })();

  return { EM13CO24: co24, EM13CO14: co14, EM13CO26: co26, EM13CO08: co08 };
}

const PALAVRAS_DA_REGUA = /\b(nota|n[ií]vel|n[ií]veis|atingiu|atingido|em processo|pontua[cç][aã]o|ranking)\b/i;
const COMPARACAO = /\b(melhor que|pior que|a turma|seus colegas|os colegas)\b/i;
const ELOGIO = /\b(parab[eé]ns|mandou bem|[oó]timo trabalho|excelente|muito bem)\b/i;
const palavras = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

/** O tamanho de um bloco da devolutiva — o modelo tem de 35 a 60 palavras; a IA ganha folga dos dois lados. */
export const PALAVRAS_DO_BLOCO = { min: 15, max: 75 } as const;

/**
 * A régua da devolutiva da IA. Fora dela, a tentativa é recusada e o modelo
 * responde: as quatro habilidades, o tamanho, nenhuma palavra da régua do
 * professor, nenhuma comparação com colegas — e nenhum elogio onde o
 * estudante não fez nada.
 */
export function problemasDaDevolutiva(textos: Partial<Record<string, string>>, f: FatosDaDevolutiva): string[] {
  const p: string[] = [];
  for (const h of HABILIDADES_DA_DEVOLUTIVA) {
    const t = textos[h]?.trim() ?? "";
    if (!t) {
      p.push(`Falta a devolutiva de ${h}.`);
      continue;
    }
    const w = palavras(t);
    if (w < PALAVRAS_DO_BLOCO.min || w > PALAVRAS_DO_BLOCO.max) p.push(`A devolutiva de ${h} precisa ter de ${PALAVRAS_DO_BLOCO.min} a ${PALAVRAS_DO_BLOCO.max} palavras.`);
    if (PALAVRAS_DA_REGUA.test(t)) p.push(`A devolutiva de ${h} usa uma palavra da avaliação do professor.`);
    if (COMPARACAO.test(t)) p.push(`A devolutiva de ${h} compara o estudante com outras pessoas.`);
    if (f.niveis[h] === "nao_atingiu" && ELOGIO.test(t)) p.push(`A devolutiva de ${h} elogia uma ação que o estudante não fez.`);
  }
  const extras = Object.keys(textos).filter((k) => !(HABILIDADES_DA_DEVOLUTIVA as readonly string[]).includes(k));
  if (extras.length > 0) p.push(`Habilidades desconhecidas na devolutiva: ${extras.join(", ")}.`);
  return p;
}

/** Leitura defensiva do JSONB da sessão: forma inesperada = sem devolutiva (a rota gera de novo). */
export function lerDevolutiva(bruto: unknown): Devolutiva | null {
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return null;
  const b = bruto as Record<string, unknown>;
  const h = (b.habilidades ?? {}) as Record<string, unknown>;
  if (b.origem !== "ia" && b.origem !== "modelo") return null;
  if (!HABILIDADES_DA_DEVOLUTIVA.every((k) => typeof h[k] === "string" && (h[k] as string).trim())) return null;
  return {
    origem: b.origem,
    habilidades: Object.fromEntries(HABILIDADES_DA_DEVOLUTIVA.map((k) => [k, h[k] as string])) as Record<HabilidadeDaDevolutiva, string>,
    geradaEm: typeof b.geradaEm === "string" ? b.geradaEm : "",
  };
}
