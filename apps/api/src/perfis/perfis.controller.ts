import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { PERFIS } from "../comum/insta/defaults";
import { rateLimit } from "../comum/rate-limit";
import { estadoInicial, semearEstado } from "../motor/estado";
import { atividadeDoProfessor, ehUuid, naoEncontrado } from "../motor/guardas";
import { PrismaService } from "../prisma/prisma.service";
import { VilaService } from "../vila/vila.service";
import { Contrato } from "../openapi/contrato";
import { normalizarPerfil, ordemDeRedistribuicao, quantosMover, rotuloDoPerfil, type LadoTese } from "./afinidade";
import {
  DaVilaSchema,
  DistribuicaoSchema,
  ImportadosDaVilaSchema,
  ImportadosSchema,
  ImportarPerfisSchema,
  ListaDePerfisSchema,
  PerfisManuaisSchema,
  RedistribuicaoSchema,
} from "./contrato-de-rotas";
import { distribuicaoDaTurma } from "./distribuicao";

/**
 * Ato 1 (PERFIS) — porte fiel dos handlers de `app/api/activities/[id]/{perfis,
 * distribuicao,redistribuir}` e `app/api/perfis/importar` do origem. Só muda a
 * casca: guards, tenancy explícita por `escola_id` + RLS via `comTenancy`.
 */

/** Tolerância de desequilíbrio antes de avisar o professor (doc 04 §3.1). */
const TOLERANCIA = 0.15;

/**
 * Fallback do professor quando o jogo do Ato 1 ainda não integra (doc 07).
 *
 * Aceita duas formas: escores completos (colados de planilha) ou só o perfil
 * dominante (seleção manual na lista da turma). A segunda existe porque, na
 * prática, o professor às vezes tem só o resultado final do jogo impresso.
 */
/** Escores sintéticos a partir de um dominante escolhido à mão. */
function escoresDeDominante(dominante: (typeof PERFIS)[number]) {
  const resto = 0.2 / (PERFIS.length - 1);
  return Object.fromEntries(
    PERFIS.map((perfil) => [perfil, perfil === dominante ? 0.4 : resto]),
  ) as Record<(typeof PERFIS)[number], number>;
}

type Autenticado = { auth: AuthClaims };

/** Filtro opcional da importação da Vila. Sem ele, vale a escola inteira — que é
 *  como `GET :id/perfis` já lista. Com turma, o relatório da importação fica
 *  legível: o professor roda a atividade com UMA turma. */

@Controller("atividades")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class PerfisController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vila: VilaService,
  ) {}

  @Post(":id/perfis")
  @HttpCode(200)
  @Contrato({
    resumo: "Importa perfis à mão — o fallback do professor.",
    descricao:
      "Aceita **duas formas**: escores completos (colados de planilha) ou só o `dominante` (seleção manual na lista). A segunda existe porque, na prática, o professor às vezes tem só o resultado final do jogo impresso.",
    params: z.object({ id: z.string().uuid() }),
    corpo: PerfisManuaisSchema,
    resposta: ImportadosSchema,
    notas: ["`username` que não existe nesta escola volta em `desconhecidos` — dito, nunca engolido."],
  })
  async importarManual(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();

    const parsed = PerfisManuaisSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        mensagem: "Confira os perfis enviados.",
        campos: parsed.error.flatten().fieldErrors,
      });
    }

    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, usuarioId, escolaId);
      if (!atividade) naoEncontrado();

      const usuarios = await tx.user.findMany({
        where: { role: "aluno", escolaId, username: { in: parsed.data.perfis.map((p) => p.username) } },
        select: { id: true, username: true },
      });
      const idPorUsername = new Map(usuarios.map((u) => [u.username, u.id]));

      const desconhecidos: string[] = [];
      let importados = 0;

      for (const entrada of parsed.data.perfis) {
        const alunoId = idPorUsername.get(entrada.username);
        if (!alunoId) {
          desconhecidos.push(entrada.username);
          continue;
        }

        const brutos = "escores" in entrada ? entrada.escores : escoresDeDominante(entrada.dominante);
        const perfil = normalizarPerfil(brutos);
        const dados = {
          escores: perfil.escores as unknown as Prisma.InputJsonObject,
          dominante: perfil.dominante,
          origem: "professor",
          medidoEm: new Date(),
        };

        await tx.perfilImportado.upsert({
          where: { activityId_alunoId: { activityId: id, alunoId } },
          create: { escolaId, activityId: id, alunoId, ...dados },
          update: dados,
        });
        importados += 1;
      }

      return { importados, ignorados: desconhecidos.length, desconhecidos };
    });
  }

  /**
   * IMPORTA OS PERFIS DA VILA DO LUME (exp-70) para esta atividade.
   *
   * Fecha o "Ato 1" que a ficha do Instanooria sempre descreveu: *"fora da
   * plataforma, um jogo mede o perfil de valores do aluno"*. O jogo deixou de
   * estar fora — e o comentário do `PerfisImportacaoController` lá embaixo, que
   * chama a importação manual de "fallback do professor quando o jogo do Ato 1
   * ainda não integra", tem uma resposta agora.
   *
   * ## Três decisões que estão neste método
   *
   * **É o professor que dispara, não a plataforma.** Sobrescrever sozinho
   * desfaria em silêncio uma redistribuição que ele já tinha feito antes da
   * aula, e a partida da Vila pode acontecer depois de a atividade ter começado.
   *
   * **`ladoForcado` é PRESERVADO.** O `update` toca `escores`, `dominante`,
   * `origem` e `medidoEm` e nada mais — quem foi movido de lado à mão continua
   * movido. Se o `update` levasse o objeto inteiro, a importação apagaria a
   * decisão pedagógica dele sem avisar (`largada.ts` dá precedência a
   * `ladoForcado` justamente para isso).
   *
   * **Quem não entrou é NOMEADO.** Perfil de partida curta é descartado (ver
   * `quadrantes.ts`), e uma resposta que só diz "23 importados" faria o
   * professor achar que a turma inteira entrou.
   */
  @Post(":id/perfis/da-vila")
  @Contrato({
    resumo: "Traz os perfis da Vila do Lume para a largada do Instanooria.",
    descricao:
      "Colapsa o perfil Schwartz da exp-70 nos quatro quadrantes e grava com `origem: \"jogo\"` — é o que decide de que lado o feed nasce. O disparo é do PROFESSOR: importar sozinho desfaria em silêncio uma redistribuição feita antes da aula.",
    params: z.object({ id: z.string().uuid() }),
    query: DaVilaSchema,
    resposta: ImportadosDaVilaSchema,
    notas: [
      "O colapso tem duas travas que CUSTAM alunos, de propósito: valor não observado (`indicative`/`none`) fica **fora da média**, nunca entra como zero; e quadrante sem nenhum membro observado **invalida o perfil inteiro**.",
      "Sem perfil, o Instanooria cai no sorteio balanceado — que é honesto sobre não saber.",
      "Exige `amostraSuficiente`: o `dominante` vira coluna no CSV do `/analise` ao lado da identidade da criança.",
      "`ladoForcado` é PRESERVADO no upsert.",
    ],
  })
  @HttpCode(200)
  async importarDaVila(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();
    const filtro = DaVilaSchema.parse(body ?? {});
    const { usuarioId, escolaId } = req.auth;

    /* A leitura acontece FORA da transação de escrita, e de propósito: ela abre
       o próprio `comTenancy` (é do módulo `vila`, dono daquelas tabelas).
       Aninhar transação do Prisma dentro de transação não faz o que parece. */
    const doJogo = await this.vila.perfisParaOAto1(escolaId, filtro.turmaId);

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, usuarioId, escolaId);
      if (!atividade) naoEncontrado();

      let importados = 0;
      for (const entrada of doJogo.prontos) {
        const perfil = normalizarPerfil(entrada.escores);
        /* `dados` NÃO inclui `ladoForcado`: o upsert não pode desfazer a
           redistribuição do professor. */
        const dados = {
          escores: perfil.escores as unknown as Prisma.InputJsonObject,
          dominante: perfil.dominante,
          origem: "jogo",
          medidoEm: entrada.medidoEm,
        };
        await tx.perfilImportado.upsert({
          where: { activityId_alunoId: { activityId: id, alunoId: entrada.alunoId } },
          create: { escolaId, activityId: id, alunoId: entrada.alunoId, ...dados },
          update: dados,
        });
        importados += 1;
      }

      return {
        importados,
        semPartida: doJogo.semPartida,
        descartados: doJogo.descartados.map((d) => ({ nome: d.nome, motivo: d.motivo })),
      };
    });
  }

  /** Lista da turma com o estado do perfil por aluno, para conferência. */
  @Get(":id/perfis")
  @Contrato({
    resumo: "O estado do perfil de cada aluno, para conferência.",
    params: z.object({ id: z.string().uuid() }),
    resposta: ListaDePerfisSchema,
    notas: ["`origem: \"ausente\"` = a criança ainda não tem perfil; ela cai no sorteio."],
  })
  async listar(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();

    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, usuarioId, escolaId);
      if (!atividade) naoEncontrado();

      const [alunos, perfis] = await Promise.all([
        tx.user.findMany({
          where: { role: "aluno", escolaId },
          select: { id: true, username: true, displayName: true },
          orderBy: { username: "asc" },
        }),
        tx.perfilImportado.findMany({ where: { activityId: id, escolaId } }),
      ]);

      const porAluno = new Map(perfis.map((perfil) => [perfil.alunoId, perfil]));

      return {
        alunos: alunos.map((aluno) => {
          const perfil = porAluno.get(aluno.id);
          return {
            username: aluno.username,
            displayName: aluno.displayName,
            origem: perfil?.origem ?? "ausente",
            dominante: perfil?.dominante ?? null,
            rotulo: perfil ? rotuloDoPerfil(perfil.dominante as never) : null,
            escores: perfil?.escores ?? null,
            medidoEm: perfil?.medidoEm ?? null,
          };
        }),
        resumo: {
          comPerfil: perfis.length,
          semPerfil: alunos.length - perfis.length,
          doJogo: perfis.filter((p) => p.origem === "jogo").length,
          doProfessor: perfis.filter((p) => p.origem === "professor").length,
        },
      };
    });
  }

  /**
   * Onde cada aluno vai cair, ANTES de a turma começar (doc 07).
   *
   * O professor precisa ver isso antes porque a distribuição de perfis varia por
   * sala: se ela estiver muito torta, ele redistribui — e redistribuir depois que
   * a turma começou não é possível sem invalidar sessões.
   */
  @Get(":id/distribuicao")
  @Contrato({
    resumo: "Onde cada aluno vai cair — antes de começar.",
    descricao:
      "Existe para o professor **ver antes**. A distribuição de perfis varia por sala, e aí os lados nascem desequilibrados: não é defeito do sistema, é a turma — mas o professor precisa saber antes, não descobrir no meio da aula.",
    params: z.object({ id: z.string().uuid() }),
    resposta: DistribuicaoSchema,
    notas: [
      "`semLado` são os que caem no SORTEIO (perfil ausente ou `misto`): não entram na projeção porque o lado só é decidido quando a run nasce.",
      "`precisaRedistribuir` é `desequilibrio > 0.15`.",
    ],
  })
  async distribuicao(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();

    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, usuarioId, escolaId);
      if (!atividade) naoEncontrado();

      const distribuicao = await distribuicaoDaTurma(tx, id, atividade.antagonismo);

      return {
        ...distribuicao,
        tolerancia: TOLERANCIA,
        precisaRedistribuir: distribuicao.desequilibrio > TOLERANCIA,
      };
    });
  }

  /**
   * Rebalanceia a turma quando ela cai quase toda num lado (doc 04 §3.1).
   *
   * Duas regras que definem o comportamento:
   *
   * 1. **Move os de afinidade mais fraca primeiro** — `misto` antes de todos,
   *    depois por margem crescente. Preserva a pedagogia onde o sinal do perfil é
   *    forte; o contrário seria mover um aluno de perfil claríssimo e depois ter
   *    que explicar isso a ele no relatório.
   * 2. **Só age em quem ainda não começou.** Trocar o lado de quem já está rolando
   *    o feed invalidaria a sessão: os scores acumulados passariam a contar para o
   *    lado errado.
   */
  @Post(":id/redistribuir")
  @Contrato({
    resumo: "Rebalanceia a turma quando ela cai quase toda num lado.",
    descricao:
      "Duas regras definem o comportamento:\n\n1. **Move os de afinidade mais fraca primeiro** — `misto` antes de todos, depois por margem crescente. Preserva a pedagogia onde o sinal do perfil é forte.\n2. **Só age em quem ainda não começou.** Trocar o lado de quem já está rolando o feed invalidaria a sessão: os scores acumulados passariam a contar para o lado errado.",
    params: z.object({ id: z.string().uuid() }),
    resposta: RedistribuicaoSchema,
    notas: [
      "`bloqueados` conta quem já começou e por isso ficou — o rebalanceamento pode não ter chegado ao alvo, e o professor precisa saber.",
      "Pergunta e lados não aprovados ⇒ **409**.",
    ],
  })
  @HttpCode(200)
  async redistribuir(@Param("id") id: string, @Req() req: Autenticado) {
    if (!ehUuid(id)) naoEncontrado();

    const { usuarioId, escolaId } = req.auth;
    return this.prisma.comTenancy(async (tx) => {
      const atividade = await atividadeDoProfessor(tx, id, usuarioId, escolaId);
      if (!atividade) naoEncontrado();

      const distribuicao = await distribuicaoDaTurma(tx, id, atividade.antagonismo);

      if (!distribuicao.temAfinidade) {
        throw new HttpException(
          { mensagem: "Aprove a pergunta e os dois lados antes de distribuir a turma." },
          409,
        );
      }

      const alvo = quantosMover(distribuicao.contagem, TOLERANCIA);
      if (!alvo) {
        return {
          ok: true,
          movidos: [],
          mensagem: "A turma já está equilibrada.",
          contagem: distribuicao.contagem,
        };
      }

      const paraOutroLado: LadoTese = alvo.de === "A" ? "B" : "A";

      /**
       * Candidatos: quem está no lado excedente e ainda não começou. Quem já está
       * no feed fica de fora — e isso aparece na resposta, para o professor saber
       * que o rebalanceamento pode não ter chegado ao alvo.
       */
      const candidatos = ordemDeRedistribuicao(
        distribuicao.alunos
          .filter((aluno) => aluno.lado === alvo.de && !aluno.jaComecou)
          .map((aluno) => ({
            username: aluno.username,
            displayName: aluno.displayName,
            dominante: aluno.dominante as never,
            margem: aluno.margem,
            rotulo: aluno.rotulo,
          })),
      ).slice(0, alvo.quantos);

      const bloqueados = distribuicao.alunos.filter(
        (aluno) => aluno.lado === alvo.de && aluno.jaComecou,
      ).length;

      if (candidatos.length === 0) {
        throw new HttpException(
          {
            mensagem:
              bloqueados > 0
                ? "Todos os alunos do lado excedente já começaram a atividade — trocar o lado deles invalidaria a sessão."
                : "Não há alunos para mover.",
            bloqueados,
          },
          409,
        );
      }

      const usuarios = await tx.user.findMany({
        where: { escolaId, username: { in: candidatos.map((c) => c.username) } },
        select: { id: true, username: true },
      });
      const idPorUsername = new Map(usuarios.map((u) => [u.username, u.id]));
      const config = atividade.engineConfig as unknown as { sementeInicial?: number };

      /**
       * Duas gravações, e as duas são necessárias.
       *
       * 1. `perfis_importados.lado_forcado` — o professor redistribui ANTES de a
       *    aula começar, quando nenhuma run existe. Sem persistir aqui, o primeiro
       *    `POST /runs` recalcularia o lado pela afinidade e desfaria em
       *    silêncio o que ele decidiu.
       * 2. A run em `onboarding`, para quem já fez login mas não começou a rolar.
       *    Quem já está no feed fica de fora: trocar o lado no meio da sessão faria
       *    os scores acumulados contarem para o lado errado.
       *
       * O origem abria um `$transaction` próprio aqui; no porte já estamos DENTRO
       * da transação do `comTenancy` (que é onde a RLS está armada), então as
       * gravações vão em sequência na mesma transação — mesma atomicidade.
       */
      for (const candidato of candidatos) {
        const alunoId = idPorUsername.get(candidato.username)!;
        await tx.perfilImportado.updateMany({
          where: { activityId: id, alunoId, escolaId },
          data: { ladoForcado: paraOutroLado },
        });
        await tx.run.updateMany({
          where: { activityId: id, alunoId, escolaId, fase: "onboarding" },
          data: {
            ladoInicial: paraOutroLado,
            ladoOrigem: "redistribuido",
            engineState: semearEstado(
              estadoInicial(),
              paraOutroLado,
              config.sementeInicial,
              candidato.dominante,
            ) as unknown as Prisma.InputJsonObject,
          },
        });
      }

      return {
        ok: true,
        de: alvo.de,
        para: paraOutroLado,
        movidos: candidatos.map((c) => ({
          username: c.username,
          displayName: c.displayName,
          perfil: c.rotulo,
          margem: Number(c.margem.toFixed(3)),
        })),
        bloqueados,
      };
    });
  }
}

/**
 * Ponte do Ato 1 → Ato 2 (doc 07, doc 10 §4).
 *
 * Chamada pelo JOGO, que roda fora do navegador e não tem sessão. Por isso a
 * autenticação é por chave de serviço no header, não por cookie — e por isso o
 * rate limit é por token, não por IP: o jogo pode chamar de qualquer lugar.
 */
/**
 * INTEGRAÇÃO EXTERNA — fica FORA de `OidcGuard`/`RolesGuard` de propósito: o
 * chamador é o jogo do Ato 1, um serviço, não um usuário logado.
 */
@Controller("perfis")
export class PerfisImportacaoController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post("importar")
  @HttpCode(200)
  @Contrato({
    resumo: "Ponte externa do Ato 1 — compatibilidade.",
    descricao:
      "Chamada pelo JOGO, que roda fora do navegador e não tem sessão: autenticação por chave de serviço no cabeçalho, não por cookie.\n\nContinua viva como compatibilidade; hoje o caminho normal é `POST /atividades/:id/perfis/da-vila`, disparado pelo professor.",
    corpo: ImportarPerfisSchema,
    resposta: ImportadosSchema,
    acesso: "servico",
    notas: [
      "`escolaId` vem no CORPO porque esta rota não tem token: sem ele não há escola no contexto, e `comTenancy` falha alto. O `activityId` é conferido DENTRO dessa escola, então um `escolaId` errado não alcança atividade de outra rede.",
      "Sem `PERFIL_IMPORT_TOKEN` a rota responde **503** — desligada, nunca aberta.",
    ],
  })
  async importar(@Headers("x-perfil-token") token: string | undefined, @Body() body: unknown) {
    const esperado = this.config.get<string>("PERFIL_IMPORT_TOKEN");

    if (!esperado) {
      throw new HttpException(
        { mensagem: "Importação de perfis desligada: PERFIL_IMPORT_TOKEN não configurado." },
        503,
      );
    }
    if (token !== esperado) {
      throw new HttpException({ mensagem: "Token inválido." }, 401);
    }

    const limite = rateLimit(`perfis:${token.slice(0, 8)}`, 30, 60_000);
    if (!limite.ok) {
      throw new HttpException({ mensagem: "Muitas importações seguidas." }, 429);
    }

    const parsed = ImportarPerfisSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        mensagem: "Payload inválido.",
        campos: parsed.error.flatten().fieldErrors,
      });
    }

    const { escolaId, activityId, alunos } = parsed.data;

    return this.prisma.comTenancy(async (tx) => {
      const atividade = await tx.activity.findFirst({
        where: { id: activityId, escolaId },
        select: { id: true },
      });
      if (!atividade) throw new HttpException({ mensagem: "Atividade não encontrada." }, 404);

      const usuarios = await tx.user.findMany({
        where: { role: "aluno", escolaId, username: { in: alunos.map((aluno) => aluno.username) } },
        select: { id: true, username: true },
      });
      const idPorUsername = new Map(usuarios.map((usuario) => [usuario.username, usuario.id]));

      const desconhecidos: string[] = [];
      let importados = 0;

      for (const aluno of alunos) {
        const alunoId = idPorUsername.get(aluno.username);
        if (!alunoId) {
          // Um username errado não derruba o lote inteiro: o jogo pode ter uma
          // turma a mais, e o professor precisa saber quais faltaram.
          desconhecidos.push(aluno.username);
          continue;
        }

        const perfil = normalizarPerfil(aluno.escores);
        const dados = {
          escores: perfil.escores as unknown as Prisma.InputJsonObject,
          dominante: perfil.dominante,
          origem: "jogo",
          medidoEm: aluno.medidoEm ? new Date(aluno.medidoEm) : new Date(),
        };

        await tx.perfilImportado.upsert({
          where: { activityId_alunoId: { activityId, alunoId } },
          create: { escolaId, activityId, alunoId, ...dados },
          update: dados,
        });
        importados += 1;
      }

      return {
        importados,
        ignorados: desconhecidos.length,
        desconhecidos,
      };
    }, escolaId);
  }
}
