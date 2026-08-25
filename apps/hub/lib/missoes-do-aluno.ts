import { ANOS } from "./entre-redes/catalogo";

/**
 * O que o ALUNO vê no hub dele (`/aluno`): as missões jogáveis hoje.
 *
 * SEM SEGREGAÇÃO POR SÉRIE (decisão atual): com duas missões publicadas,
 * amarrar cada aluno à série dele deixaria a maioria das turmas com um hub
 * vazio. O aluno escolhe a missão; a série volta a filtrar quando o catálogo
 * cobrir os 12 anos (a fonte então é `experiencias.series` do manifesto).
 *
 * Só entra missão com copy de aluno (`missao.aluno`): a copy do professor fala
 * em competência, ficha e — no Instanooria — entrega a virada da missão. Quem
 * publicar uma missão nova precisa escrever essa copy, senão ela não aparece
 * para o aluno (o teste deste arquivo cobra isso).
 */
export type MissaoDoAluno = {
  expId: string;
  titulo: string;
  chamada: string;
  /** Rota do aparelho: a experiência embedada em tela cheia. */
  rota: string;
};

export const MISSOES_DO_ALUNO: MissaoDoAluno[] = ANOS.flatMap((ano) => ano.missoes)
  .filter((missao) => missao.status === "disponivel" && missao.expId && missao.aluno)
  .map((missao) => ({
    expId: missao.expId!,
    titulo: missao.aluno!.titulo,
    chamada: missao.aluno!.chamada,
    rota: `/exp/${missao.expId!}`,
  }));
