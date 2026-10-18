import { z } from "zod";
import {
  DECISOES_DA_SIMULACAO,
  IDS_DE_SIMULACAO,
  TIPOS_DE_PISTA,
  VEREDITOS,
  type DecisaoDaSimulacao,
  type IdDeSimulacao,
  type TipoDePista,
  type Veredito,
} from "../vocabulario";
import { ehBlocoPilar, type Montagem } from "./montagem";

/**
 * A SIMULAÇÃO da Chave (3.0.0, ADR-168) — a criança aplica a Chave QUE ELA
 * MONTOU a duas matérias novas. Puro.
 *
 * A tela mostra a Chave dela como roteiro: vaga a vaga, abre a pista daquele
 * bloco, marca "confio / não confio" (obrigatório para avançar — o plenário
 * pediu, para que "parou onde a regra manda" seja sempre decidível) e, quando
 * a vaga diz "Não publico" e a pista falhou, para. Vaga com isca é pulada pela
 * tela ("esta matéria não tem foto"): a matéria da simulação não tem o que
 * a isca olharia, e pular é a execução fiel dela.
 *
 * O que se mede é a FIDELIDADE à regra dela — não se a regra está certa (isso
 * é a montagem) nem se o "confio" bate com o gabarito (isso é a mesa):
 * - abriu as pistas NA ORDEM das vagas dela, puladas as iscas;
 * - depois de "não confio" numa vaga "Não publico", não abriu mais nada e
 *   decidiu "não publicar"; numa vaga "Olho a próxima pista", seguiu;
 * - publicou só se não marcou "não confio" em nenhuma pista daquela matéria
 *   (a combinação das partes, como na mesa).
 * Com "Só na primeira notícia", só a 1ª matéria está no escopo: a 2ª aparece,
 * e qualquer execução nela é fiel.
 */

export interface PassoDaSimulacao {
  tipo: TipoDePista;
  veredito: Veredito;
}

export interface MateriaSimulada {
  id: IdDeSimulacao;
  passos: PassoDaSimulacao[];
  decisao: DecisaoDaSimulacao;
}

export interface Simulacao {
  materias: MateriaSimulada[];
}

/** O corpo do `POST simulacao`: as duas matérias, cada uma com os passos na ordem em que a criança os deu. */
export const SimulacaoSchema = z.object({
  materias: z
    .array(
      z.object({
        id: z.enum(IDS_DE_SIMULACAO),
        passos: z
          .array(z.object({ tipo: z.enum(TIPOS_DE_PISTA), veredito: z.enum(VEREDITOS) }))
          .max(TIPOS_DE_PISTA.length)
          .refine((ps) => new Set(ps.map((p) => p.tipo)).size === ps.length, { message: "Cada pista uma vez." }),
        decisao: z.enum(DECISOES_DA_SIMULACAO),
      }),
    )
    .length(IDS_DE_SIMULACAO.length)
    .refine((ms) => new Set(ms.map((m) => m.id)).size === ms.length, { message: "As duas matérias, uma vez cada." }),
});

export function simulacaoDaLinha(bruto: unknown): Simulacao | null {
  const lido = SimulacaoSchema.safeParse(bruto);
  return lido.success ? lido.data : null;
}

/** As pistas que a Chave manda abrir, na ordem das vagas — as iscas não têm pista e saem. */
export function roteiroDaChave(m: Montagem): Array<{ tipo: TipoDePista; parar: boolean }> {
  return m.vagas
    .filter((v) => ehBlocoPilar(v.bloco))
    .map((v) => ({ tipo: v.bloco as TipoDePista, parar: v.seFalhar === "parar" }));
}

/** A execução de UMA matéria foi fiel à Chave? */
export function execucaoFiel(m: Montagem, materia: Pick<MateriaSimulada, "passos" | "decisao">): boolean {
  const roteiro = roteiroDaChave(m);
  let i = 0;
  let parou = false;
  for (const passo of materia.passos) {
    if (parou) return false; // abriu pista depois de a regra mandar parar
    const esperado = roteiro[i];
    if (!esperado || esperado.tipo !== passo.tipo) return false; // fora da ordem dela, ou além do roteiro
    i += 1;
    if (passo.veredito === "nao_confio" && esperado.parar) parou = true;
  }
  /* Sem parar, ela tem de ter percorrido o roteiro inteiro. */
  if (!parou && i < roteiro.length) return false;
  const falhou = materia.passos.some((p) => p.veredito === "nao_confio");
  return materia.decisao === (falhou ? "nao_publicar" : "publicar");
}

/** A simulação inteira foi fiel — as matérias do ESCOPO da repetição dela. */
export function simulacaoFiel(m: Montagem, s: Simulacao): boolean {
  const porId = new Map(s.materias.map((x) => [x.id, x]));
  const escopo: readonly IdDeSimulacao[] = m.repeticao === "todas" ? IDS_DE_SIMULACAO : [IDS_DE_SIMULACAO[0]];
  return escopo.every((id) => {
    const materia = porId.get(id);
    return materia !== undefined && execucaoFiel(m, materia);
  });
}
