import { ANOS, MISSOES_TRANSVERSAIS } from "./entre-redes/catalogo";

/**
 * O que o ESTUDANTE vê no hub dele (`/estudante`): as missões jogáveis hoje.
 *
 * SEM SEGREGAÇÃO POR SÉRIE (decisão atual): com duas missões publicadas,
 * amarrar cada estudante à série dele deixaria a maioria das turmas com um hub
 * vazio. O estudante escolhe a missão; a série volta a filtrar quando o catálogo
 * cobrir os 12 anos (a fonte então é `experiencias.series` do manifesto).
 *
 * Só entra missão com copy de estudante (`missao.estudante` ou `missao.estudante`): a copy do professor fala
 * em competência, ficha e — no Instanooria — entrega a virada da missão. Quem
 * publicar uma missão nova precisa escrever essa copy, senão ela não aparece
 * para o estudante (o teste deste arquivo cobra isso).
 */
export type MissaoDoEstudante = {
  expId: string;
  titulo: string;
  chamada: string;
  /** Rota do aparelho: a experiência embedada em tela cheia. */
  rota: string;
};


export const MISSOES_DO_ESTUDANTE: MissaoDoEstudante[] = [
  /* As transversais vêm PRIMEIRO, e isso é sobre ordem pedagógica, não estética.
     Elas não pertencem a ano nenhum — logo não são "depois" de nada —, e a Vila
     do Lume é o Ato 1 do Instanooria: é o perfil medido lá que decide de que
     lado o feed nasce aqui. Com ela no fim da lista, a criança encontrava o Ato
     2 antes do Ato 1 e nada na tela dizia o que faltou; ela entrava no
     Instanooria pelo sorteio balanceado, que é o caminho de quem não jogou.

     Não há GATE, e não deve haver: a falta de partida na Vila nunca bloqueia o
     Instanooria. O que muda aqui é só a ordem em que a escolha é oferecida.

     Elas entram sem condição nenhuma — é o que "transversal" significa aqui.
     Quando o filtro por série voltar, continuam entrando: `series: []` no
     manifesto quer dizer TODAS as séries, não nenhuma. */
  ...MISSOES_TRANSVERSAIS,
  ...ANOS.flatMap((ano) => ano.missoes),
]
  .filter((missao) => missao.status === "disponivel" && missao.expId && (missao.estudante))
  .map((missao) => {
    const copy = missao.estudante!;
    return {
      expId: missao.expId!,
      titulo: copy.titulo,
      chamada: copy.chamada,
      rota: `/exp/${missao.expId!}`,
    };
  });

