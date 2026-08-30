import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { escolaAlvo } from "../comum/escola-alvo";
import { Contrato } from "../openapi/contrato";
import {
  EditarEscolaSchema,
  EscolaCruaSchema,
  EscolasDaPessoaSchema,
  EscolasDaRedeSchema,
  HistoricoDoEstudanteSchema,
  HistoricoDoAlunoSchema,
  ListarEscolasSchema,
  LotarEmLoteSchema,
  LotarSchema,
  LoteDeLotacoesSchema,
  NovaEscolaSchema,
  OkSchema,
  PapelDeLotacaoQuery,
  PessoasLotadasSchema,
  ResumoDasEscolasSchema,
  TransferenciaSchema,
  TransferirSchema,
} from "./contrato-de-rotas";
import { EscolasService } from "./escolas.service";

type Autenticado = { auth: AuthClaims };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const vazioParaNulo = (v: string | undefined) => (v === undefined ? undefined : v === "" ? null : v);

/**
 * A REDE: escolas do contrato e o vínculo das pessoas com elas.
 *
 * Criar escola é `admin-contrato` e ninguém mais: escola é *tenant*, e abrir um
 * inquilino novo — com RLS, dados de menores e stack por trás — não é operação
 * de quem administra uma unidade.
 */
@Controller("escolas")
@UseGuards(OidcGuard, RolesGuard)
export class EscolasController {
  constructor(private readonly escolas: EscolasService) {}

  /**
   * As escolas de QUEM ESTÁ PEDINDO. Declarada antes de `:id` de propósito: no
   * Nest a primeira rota que casa vence.
   *
   * É a rota que o hub consulta para montar o seletor de escola do professor de
   * duas unidades — e para VALIDAR a troca antes de assinar um token com a
   * escola nova. Sem ela, bastaria pedir uma escola qualquer.
   */
  @Get("minhas")
  @Roles("estudante", "professor", "gestor", "admin-contrato")
  @Contrato({
    resumo: "As escolas de QUEM ESTÁ PEDINDO.",
    descricao:
      "Declarada antes de `:id` de propósito: no Nest a primeira rota que casa vence.\n\nÉ com ela que o hub monta o seletor de escola do professor de duas unidades — e **valida a troca** antes de assinar um token com a escola nova. A validação é sempre contra esta rota, nunca contra a lista que o cookie carrega: senão bastaria pedir uma escola qualquer.",
    resposta: EscolasDaPessoaSchema,
    notas: [
      "Barata de propósito: está no caminho do LOGIN. Contagens ficam em `/escolas/minhas/resumo`.",
      "Professor e gestor ACUMULAM lotação; aluno tem UMA ativa, garantida por índice único parcial no banco.",
    ],
  })
  minhas(@Req() req: Autenticado) {
    return this.escolas.escolasDaPessoa(req.auth.usuarioId);
  }

  /** O panorama de quem tem muitas escolas — a tela do supervisor de diretoria. */
  @Get("minhas/resumo")
  @Roles("professor", "gestor", "admin-contrato")
  @Contrato({
    resumo: "O panorama de quem tem muitas escolas.",
    descricao:
      "A tela do supervisor de diretoria. **LISTA, não soma**: uma linha por unidade, com turmas, alunos e quantos ainda não fizeram o primeiro acesso.\n\nSomar escolas numa métrica só seria autorizar por hierarquia — exatamente o que a ADR-34 recusa. O supervisor não é papel novo: é um `gestor` lotado nas unidades da diretoria.",
    resposta: ResumoDasEscolasSchema,
  })
  resumo(@Req() req: Autenticado) {
    return this.escolas.resumoDasEscolasDaPessoa(req.auth.usuarioId);
  }

  @Get()
  @Roles("admin-contrato")
  @Contrato({
    resumo: "Todas as escolas do contrato, com contagem.",
    descricao:
      "Só `admin-contrato` chega aqui. O filtro `paiId` é o insumo da lotação em lote: ele resolve \"as unidades desta diretoria\" em LISTA, que é o que a tela mostra para o admin confirmar.",
    query: ListarEscolasSchema,
    resposta: EscolasDaRedeSchema,
  })
  listar(@Query() query: Record<string, string>) {
    return this.escolas.listar(ListarEscolasSchema.parse(query));
  }

  /**
   * Lota uma pessoa em MUITAS escolas de uma vez: é assim que o supervisor de uma
   * Diretoria de Ensino nasce — um `gestor` lotado nas unidades dela, sem papel
   * novo e sem tocar na RLS (o token continua carregando UMA escola).
   *
   * Só `admin-contrato`: dar acesso a cinquenta escolas de uma vez não é operação
   * de quem administra uma unidade.
   */
  @Post("lotacoes-em-lote")
  @Roles("admin-contrato")
  @Contrato({
    resumo: "Lota uma pessoa em MUITAS escolas de uma vez.",
    descricao:
      "É assim que o supervisor de uma Diretoria de Ensino nasce: um `gestor` lotado nas unidades dela, **sem papel novo e sem tocar na RLS** — o token continua carregando UMA escola.\n\nIdempotente: reaplicar reabre o que estava encerrado e não duplica.",
    corpo: LotarEmLoteSchema,
    resposta: LoteDeLotacoesSchema,
    notas: [
      "Recebe a LISTA de escolas, nunca o critério (\"todas da regional X\"): autorizar por hierarquia seria uma segunda fonte de verdade sobre acesso, divergente da lotação no dia em que alguém corrigisse um pai.",
      "`regional` e `rede` entram em `ignoradas`: não têm turma nem dado, e virariam escola fantasma no seletor do cabeçalho.",
      "Uma transação POR escola — cinquenta numa só seguraria conexão por segundos, e falhar na décima não é motivo para desfazer as nove.",
    ],
  })
  async lotarEmLote(@Body() body: unknown) {
    const { usuarioId, papel, escolaIds } = LotarEmLoteSchema.parse(body);
    const feito = await this.escolas.lotarEmLote(escolaIds, usuarioId, papel);
    if (!feito) throw new NotFoundException("pessoa não encontrada");
    return feito;
  }

  @Post()
  @Roles("admin-contrato")
  @Contrato({
    resumo: "Cria uma escola.",
    descricao:
      "**`admin-contrato` e ninguém mais**, inclusive no `orgs.csv`: escola é *tenant*, e abrir um inquilino com RLS e dados de menores por trás não é operação de quem administra uma unidade.",
    corpo: NovaEscolaSchema,
    resposta: EscolaCruaSchema,
    notas: [
      "Id já existente é **400**.",
      "`pai_id` liga unidade a regional, e um trigger no banco recusa pai que seja `escola` ou a própria linha.",
    ],
  })
  async criar(@Body() body: unknown) {
    const dados = NovaEscolaSchema.parse(body);
    const jaExiste = await this.escolas.listar(dados.id);
    if (jaExiste.some((e) => e.id === dados.id)) {
      throw new BadRequestException(`já existe uma escola com o id "${dados.id}"`);
    }
    return this.escolas.criar({
      ...dados,
      codigoInep: vazioParaNulo(dados.codigoInep),
      uf: vazioParaNulo(dados.uf),
      paiId: vazioParaNulo(dados.paiId),
    });
  }

  @Patch(":id")
  @Roles("admin-contrato")
  @Contrato({
    resumo: "Edita os dados da escola.",
    descricao: "`id` e `tipo` não se editam: os dois circulam em token e em RLS.",
    params: z.object({ id: z.string() }),
    corpo: EditarEscolaSchema,
    resposta: EscolaCruaSchema,
  })
  async editar(@Param("id") id: string, @Body() body: unknown) {
    const dados = EditarEscolaSchema.parse(body);
    const atualizada = await this.escolas.atualizar(id, {
      ...dados,
      codigoInep: vazioParaNulo(dados.codigoInep),
      uf: vazioParaNulo(dados.uf),
      paiId: vazioParaNulo(dados.paiId),
    });
    if (!atualizada) throw new NotFoundException("escola não encontrada");
    return atualizada;
  }

  /** Quem está lotado nesta escola. Gestor vê a própria; admin, qualquer uma. */
  @Get(":id/pessoas")
  @Roles("gestor", "admin-contrato")
  @Contrato({
    resumo: "Quem está lotado nesta escola.",
    descricao:
      "Gestor vê a própria; `admin-contrato`, qualquer uma. `papel` diferente de `aluno`/`gestor` cai em `professor`.",
    params: z.object({ id: z.string() }),
    query: PapelDeLotacaoQuery,
    resposta: PessoasLotadasSchema,
    notas: [
      "O CPF vem FORMATADO e visível: o gestor confere identidade contra o sistema da rede e atende a família no balcão (ADR-33).",
    ],
  })
  pessoas(@Param("id") id: string, @Query("papel") papel: string, @Req() req: Autenticado) {
    const escolaId = escolaAlvo(req.auth, id);
    const alvo = papel === "estudante" || papel === "aluno" || papel === "gestor" ? (papel === "aluno" ? "estudante" : papel) : "professor";
    return this.escolas.pessoasDaEscola(escolaId, alvo);
  }

  /**
   * Lota alguém nesta escola. Para professor e gestor é ACRÉSCIMO: a lotação
   * que a pessoa tem em outra escola da rede continua valendo — é o caso que a
   * rede estadual tem aos milhares, e a razão de `lotacoes` existir.
   */
  @Post(":id/lotacoes")
  @Roles("gestor", "admin-contrato")
  @Contrato({
    resumo: "Lota alguém nesta escola.",
    descricao:
      "Para professor e gestor é **ACRÉSCIMO**: a lotação que a pessoa tem em outra escola da rede continua valendo — é o caso que a rede estadual tem aos milhares, e a razão de `lotacoes` existir.",
    params: z.object({ id: z.string() }),
    corpo: LotarSchema,
    resposta: OkSchema,
    notas: ["`admin-contrato` não recebe lotação: ele é a exceção cross-escola."],
  })
  async lotar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const escolaId = escolaAlvo(req.auth, id);
    const { usuarioId, papel } = LotarSchema.parse(body);
    const feito = await this.escolas.lotar(escolaId, usuarioId, papel);
    if (!feito) throw new NotFoundException("escola ou pessoa não encontrada");
    return feito;
  }
}

@Controller("lotacoes")
@UseGuards(OidcGuard, RolesGuard)
@Roles("gestor", "admin-contrato")
export class LotacoesController {
  constructor(private readonly escolas: EscolasService) {}

  /** Encerra o vínculo com a escola. Não apaga: é ele que diz que a pessoa esteve ali. */
  @Delete(":id")
  @Contrato({
    resumo: "Encerra o vínculo da pessoa com a escola.",
    descricao:
      "**Não apaga**: grava `fim`. É a lotação que diz que a pessoa esteve ali.\n\nFecha junto as matrículas de turma daquela escola (sem escola, não há turma), e se era a principal, a próxima lotação ativa assume — senão `users.escola_id` apontaria para onde a pessoa não está mais.",
    params: z.object({ id: z.string().uuid() }),
    resposta: OkSchema,
    notas: [
      "A checagem de escola vem DEPOIS de achar a lotação, porque é ela que diz de qual escola é — e um gestor não encerra vínculo de outra unidade (403).",
    ],
  })
  async encerrar(@Param("id") id: string, @Req() req: Autenticado) {
    if (!UUID.test(id)) throw new NotFoundException("lotação não encontrada");
    const feito = await this.escolas.encerrarLotacao(id);
    if (!feito) throw new NotFoundException("lotação não encontrada");
    // A checagem de escola vem DEPOIS porque é a lotação que diz de qual escola
    // ela é — e um gestor não encerra vínculo de outra unidade.
    if (req.auth.perfil !== "admin-contrato" && feito.escolaId !== req.auth.escolaId) {
      throw new ForbiddenException("lotação de outra escola");
    }
    return { ok: true };
  }
}

@Controller("estudantes")
@UseGuards(OidcGuard, RolesGuard)
export class EstudantesController {
  constructor(private readonly escolas: EscolasService) {}

  /**
   * Transferência entre escolas da rede.
   *
   * A escola de DESTINO é a de quem pede (o `escolaAlvo` cuida disso): é a
   * unidade que recebe a criança que a família matriculou nela. `admin-contrato`
   * pode mover para qualquer uma.
   *
   * O dado que o estudante produziu NÃO se move — continua com o `escola_id` da
   * escola onde aconteceu, que é verdade histórica. O que segue o estudante é a
   * identidade, e é o `historico` abaixo que a lê atravessada.
   */
  @Post(":id/transferir")
  @Roles("gestor", "admin-contrato")
  @Contrato({
    resumo: "Transfere o estudante entre escolas da rede.",
    descricao:
      "A escola de DESTINO é a de quem pede: a unidade que recebe a criança que a família matriculou nela. `admin-contrato` pode mover para qualquer uma.\n\n**O dado que o estudante produziu NÃO se move** — continua com o `escola_id` de onde aconteceu, que é verdade histórica. O que segue o estudante é a identidade (ADR-32).",
    params: z.object({ id: z.string().uuid() }),
    corpo: TransferirSchema,
    resposta: TransferenciaSchema,
    notas: [
      "É a única operação que troca o `app.escola_id` no MEIO de uma transação: sem isso o update na origem não veria linha nenhuma (a RLS o esconderia, sem erro) e a criança ficaria nas duas.",
      "`jaEstava: true` quando o destino já era a escola atual — nada foi movido.",
    ],
  })
  async transferir(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!UUID.test(id)) throw new NotFoundException("estudante não encontrado");
    const dados = TransferirSchema.parse(body);
    const destino = escolaAlvo(req.auth, dados.escolaDestinoId);
    const feito = await this.escolas.transferirEstudante({
      estudanteId: id,
      escolaDestinoId: destino,
      turmaDestinoId: dados.turmaDestinoId ?? null,
    });
    if (!feito) throw new NotFoundException("estudante ou escola de destino não encontrada");
    return feito;
  }

  /**
   * O histórico do estudante ATRAVESSANDO escolas — a única leitura fora de
   * `admin-contrato` que faz isso.
   *
   * Só alcança quem tem lotação na escola ONDE O ESTUDANTE ESTÁ HOJE: é a unidade
   * responsável por ele. Devolve participações (em que experiência, em que turma,
   * em que escola, quando), nunca o conteúdo dos instrumentos — o retrato de
   * valores da Vila e a transcrição do unooGPT continuam atrás das telas de quem
   * tem a posse pedagógica na escola onde aquilo aconteceu.
   */
  @Get(":id/historico")
  @Roles("professor", "gestor", "admin-contrato")
  @Contrato({
    resumo: "O histórico do estudante ATRAVESSANDO escolas.",
    descricao:
      "A única leitura fora de `admin-contrato` que atravessa escolas — e por isso é uma porta só. Alcança apenas quem tem lotação na escola **onde o estudante está HOJE**: é a unidade responsável por ele.",
    params: z.object({ id: z.string().uuid() }),
    resposta: HistoricoDoEstudanteSchema,
    notas: [
      "Devolve PARTICIPAÇÕES, **nunca o conteúdo dos instrumentos**: o retrato de valores da Vila e a transcrição do unooGPT continuam atrás das telas de quem tem a posse pedagógica na escola onde aquilo aconteceu.",
      "A escola de HOJE é a PRIMEIRA da lista `escolas` — a tela imprime nessa ordem, e a primeira linha é a que o adulto lê como \"a escola dela\".",
    ],
  })
  async historico(@Param("id") id: string, @Req() req: Autenticado) {
    if (!UUID.test(id)) throw new NotFoundException("estudante não encontrado");
    const historico = await this.escolas.historicoDoEstudante(id);
    if (!historico) throw new NotFoundException("estudante não encontrado");

    if (req.auth.perfil !== "admin-contrato") {
      const escolaAtual = historico.escolas.find((e) => e.atual)?.id;
      const podeVer =
        escolaAtual !== undefined && (await this.escolas.temLotacao(req.auth.usuarioId, escolaAtual));
      if (!podeVer) throw new ForbiddenException("este estudante não está numa escola sua");
    }
    return historico;
  }
}

export const AlunosController = EstudantesController;
