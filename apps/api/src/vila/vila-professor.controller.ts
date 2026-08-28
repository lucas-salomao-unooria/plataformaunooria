import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { Contrato } from "../openapi/contrato";
import { CARTOES, DESCRICAO_BOLHA } from "./catalogo";
import {
  AlunosDaTurmaSchema,
  CartoesDoProfessorSchema,
  RelatorioDoAlunoSchema,
  ResumoDaTurmaSchema,
  TurmaZeradaSchema,
  TurmasDaVilaSchema,
} from "./contrato-de-rotas";
import { VilaService } from "./vila.service";
import { professorDoToken } from "../comum/turmas-do-professor";

/**
 * Rotas do PROFESSOR. Superfície separada da do aluno, e não é organização: é a
 * única forma de o `@Roles("aluno")` da outra e o `@Roles("professor")` desta
 * serem verdade ao mesmo tempo.
 *
 * ## Quem vê o quê
 *
 * **Professor** vê a linha de uma criança das próprias turmas. **Gestor** vê
 * agregado, nunca a linha de uma criança — porta o papel `pesquisador` do app de
 * origem ("pesquisador nunca vê a linha de uma criança; só agregados").
 * **Admin-contrato** não entra aqui.
 *
 * Duas classes, e não um `@Roles` misto: a lista de turmas e o AGREGADO abrem
 * para gestor; a linha de um aluno e o relatório individual, não. Um único
 * controller com o papel mais largo no topo e exceções por método é como uma
 * rota individual acaba aberta para gestor sem ninguém notar.
 *
 * O que estas rotas devolvem já vem com a decisão de mostrar número TOMADA
 * (`leitura.ts`): valor com uma fonte de medida só não recebe número, e o tipo
 * da linha não tem onde carregá-lo.
 */

const UUID = z.string().uuid();

type Autenticado = { auth: AuthClaims };

function idOu404(bruto: string): string {
  const r = UUID.safeParse(bruto);
  if (!r.success) throw new HttpException({ mensagem: "Não encontrado." }, 404);
  return r.data;
}

/**
 * O que o GESTOR também pode ver: lista de turmas e agregado. Nada aqui
 * identifica uma criança.
 */
@Controller("vila/agregado")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor", "gestor")
export class VilaAgregadoController {
  constructor(private readonly vila: VilaService) {}

  /**
   * Turmas para o seletor. Sem filtro por série (a Vila é transversal), mas COM
   * filtro por matrícula: o professor vê as turmas dele, o gestor vê a escola.
   */
  @Get("turmas")
  @Contrato({
    resumo: "Turmas para o seletor da Vila.",
    descricao:
      "Sem filtro por série — a Vila é transversal —, mas **com** filtro por matrícula: o professor vê as turmas dele, o gestor vê a escola.",
    resposta: TurmasDaVilaSchema,
  })
  async turmas(@Req() req: Autenticado) {
    return { turmas: await this.vila.turmas(req.auth.escolaId, professorDoToken(req.auth)) };
  }

  /**
   * Agregado da turma: quantos jogaram, a distribuição de bolhas e o que
   * aconteceu com as mensagens — em contagens, nunca por criança.
   *
   * A distribuição de bolhas é o número que o professor precisa ANTES do debate:
   * sem as três bolhas na sala, o momento em que a turma descobre que recebeu
   * mensagens diferentes não acontece.
   */
  @Get("turmas/:turmaId")
  @Contrato({
    resumo: "O agregado da turma — contagens, nunca por criança.",
    descricao:
      "Abre para GESTOR também, e nenhum campo aqui identifica uma criança: porta a regra do app de origem (\"pesquisador nunca vê a linha de uma criança; só agregados\").\n\nA distribuição de bolhas é o número que o professor precisa **antes** do debate: sem as três bolhas na sala, o momento em que a turma descobre que recebeu mensagens diferentes não acontece.",
    params: z.object({ turmaId: z.string().uuid() }),
    resposta: ResumoDaTurmaSchema,
  })
  async resumo(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    return {
      resumo: await this.vila.resumoDaTurma(
        req.auth.escolaId,
        idOu404(turmaId),
        professorDoToken(req.auth),
      ),
    };
  }
}

@Controller("vila/professor")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class VilaProfessorController {
  constructor(private readonly vila: VilaService) {}

  /** Uma linha por aluno da turma: quantas partidas, a bolha, e se a última
   *  sustenta leitura. Sem números de valor — esses são da tela individual. */
  @Get("turmas/:turmaId")
  @Contrato({
    resumo: "Uma linha por aluno da turma.",
    descricao:
      "Quantas partidas, a bolha, e se a última sustenta leitura.\n\n**Sem valor de Schwartz nenhum**: listagem é ordenável, e uma coluna \"Poder\" viraria ranking de crianças. Os valores vivem na tela individual, uma criança por vez, com o grau ao lado.",
    params: z.object({ turmaId: z.string().uuid() }),
    resposta: AlunosDaTurmaSchema,
  })
  async turma(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    return {
      alunos: await this.vila.daTurma(req.auth.escolaId, idOu404(turmaId), professorDoToken(req.auth)),
    };
  }

  /**
   * Zera os dados da Vila desta turma — o botão de rodar a missão do zero.
   *
   * `DELETE`, e não um `POST /limpar`: é remoção, e o verbo diz isso a quem lê o
   * log. Devolve as contagens do que sumiu, porque "pronto" sem número deixa o
   * professor sem saber se apagou a turma certa.
   */
  @Delete("turmas/:turmaId/dados")
  @HttpCode(200)
  @Contrato({
    resumo: "Zera os dados da Vila desta turma.",
    descricao:
      "`DELETE`, e não um `POST /limpar`: é remoção, e o verbo diz isso a quem lê o log. Devolve as contagens do que sumiu — \"pronto\" sem número deixa o professor sem saber se apagou a turma certa.",
    params: z.object({ turmaId: z.string().uuid() }),
    resposta: TurmaZeradaSchema,
    notas: [
      "As **bolhas** somem junto: rodar de novo com a mesma bolha serviria à criança o mesmo golpe — ela reconhece, e a segunda rodada não mede nada.",
      "`perfis_importados` **não** é tocado: aquilo pertence à atividade do Instanooria, e apagar de lá trocaria os lados de uma aula em andamento.",
    ],
  })
  async zerar(@Param("turmaId") turmaId: string, @Req() req: Autenticado) {
    const apagado = await this.vila.zerarTurma(req.auth.escolaId, idOu404(turmaId));
    if (!apagado) throw new HttpException({ mensagem: "Turma não encontrada." }, 404);
    return apagado;
  }

  /**
   * TODOS os cartões, das três bolhas, COM o gabarito.
   *
   * É a revelação final da missão: o professor projeta as três versões lado a
   * lado, marcando quais eram verdadeiras, e é a primeira vez que a turma vê as
   * outras. Sem isto não há aula — o que a criança recebeu é um terço do
   * conjunto, e a lição está no contraste.
   *
   * Vem da api, e não de uma cópia no hub, porque OS TEXTOS SÃO O INSTRUMENTO: o
   * golpe da bolha C funciona porque não tem erro de português, não tem link
   * torto e não apressa. Uma vírgula divergente entre o que o jogo serviu e o
   * que o professor projeta faria a turma discutir uma mensagem que ninguém
   * recebeu.
   *
   * `@Roles("professor")` da classe: é o oposto da rota do aluno, que serve só a
   * bolha dele e sem `legitima`.
   */
  @Get("cartoes")
  @Contrato({
    resumo: "TODOS os cartões, das três bolhas, COM o gabarito.",
    descricao:
      "É a revelação final da missão: o professor projeta as três versões lado a lado, marcando quais eram verdadeiras, e é a primeira vez que a turma vê as outras.\n\nVem da api, e não de uma cópia no hub, porque **os textos SÃO o instrumento**: uma vírgula divergente entre o que o jogo serviu e o que o professor projeta põe a sala discutindo uma mensagem que ninguém recebeu.",
    query: z.object({ turmaId: z.string().uuid().optional() }),
    resposta: CartoesDoProfessorSchema,
    notas: [
      "**COM `turmaId`, devolve só as bolhas que AQUELA sala recebeu.** Sem isso, o guia de uma turma de 3º ano projetava o golpe da bolha B — que a api nunca serviu ali — e mandava o professor esperar a reação de um grupo que não existe na sala.",
      "`bolhasDaTurma: null` = nenhuma turma escolhida; a tela mostra as três e avisa.",
    ],
  })
  async cartoes(@Query("turmaId") turmaId: string | undefined, @Req() req: Autenticado) {
    /* COM turma, devolve só as bolhas que AQUELA sala recebeu.
       Sem isto, o guia de uma turma de 3º ano projetava o golpe da bolha B — que
       a api nunca serviu ali — e mandava o professor esperar a reação de um grupo
       que não existe na sala. A regra é a mesma de `abrir`: `bolhasElegiveis`. */
    const elegiveis = turmaId
      ? await this.vila.bolhasDaTurma(req.auth.escolaId, idOu404(turmaId))
      : null;
    const visiveis = elegiveis
      ? CARTOES.filter((c) => c.nivel === "comum" || elegiveis.includes(c.nivel))
      : CARTOES;

    return {
      /** null = nenhuma turma escolhida; a tela mostra as três e avisa. */
      bolhasDaTurma: elegiveis,
      cartoes: visiveis.map((c) => ({
        id: c.id,
        nivel: c.nivel,
        legitima: c.legitima,
        tag: c.tag,
        beats: c.beats,
        opcoes: c.options.map((o) => ({ texto: o.text, aceita: o.aceita })),
      })),
      bolhas: DESCRICAO_BOLHA,
    };
  }

  /**
   * O relatório da última partida concluída de um aluno.
   *
   * A seção das mensagens abre pelo NÍVEL que ela recebeu, antes do que ela fez:
   * "caiu em 2 de 3" sem dizer que era o nível C faz o adulto concluir que a
   * criança é ingênua — o rótulo que este projeto existe para não produzir.
   */
  @Get("alunos/:alunoId")
  @Contrato({
    resumo: "O relatório da última partida concluída de um aluno.",
    descricao:
      "**Professor only** — o gestor tem o agregado, nunca a linha de uma criança. São controllers separados de propósito: um `@Roles` misto com exceção por método é como uma rota individual acaba aberta para gestor sem ninguém notar.\n\nA seção das mensagens abre pelo **NÍVEL** que ela recebeu, antes do que ela fez: \"caiu em 2 de 3\" sem dizer que era o nível C faz o adulto concluir que a criança é ingênua — o rótulo que este projeto existe para não produzir.",
    params: z.object({ alunoId: z.string().uuid() }),
    resposta: RelatorioDoAlunoSchema,
    notas: [
      "`relatorio: null` é resposta legítima: o aluno existe e não jogou. Um 404 faria a tela dizer \"não encontrado\" para uma criança da turma dele.",
      "`grau` é invariante de API: só a variante `scored` tem número; as outras têm `null` POR TIPO, então o hub não consegue imprimir \"Poder 100\" a partir de um sinal só.",
      "`mensagens: null` = nenhum cartão chegou a aparecer — **não** é \"ela ignorou tudo\".",
    ],
  })
  async aluno(@Param("alunoId") alunoId: string, @Req() req: Autenticado) {
    const relatorio = await this.vila.doAluno(req.auth.escolaId, idOu404(alunoId));
    /* `null` é resposta legítima: o aluno existe e não jogou. 404 aqui faria a
       tela do professor dizer "não encontrado" para uma criança da turma dele. */
    return { relatorio };
  }
}
