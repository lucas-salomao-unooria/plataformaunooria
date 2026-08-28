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
import { EscolasService } from "./escolas.service";

type Autenticado = { auth: AuthClaims };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O id da escola circula no claim do token e no `set_config` da RLS: nada de
 *  espaço, acento ou barra — um id legível (`sp-035001`) vale mais que um UUID. */
const IdDeEscola = z
  .string()
  .trim()
  .regex(
    /^[a-z0-9][a-z0-9._-]{2,63}$/,
    "id: 3–64 caracteres [a-z 0-9 . _ -], começando por letra ou número",
  );

const NovaEscolaSchema = z.object({
  id: IdDeEscola,
  nome: z.string().trim().min(1).max(160),
  tipo: z.enum(["escola", "rede", "distrito"]).default("escola"),
  codigoInep: z
    .union([z.literal(""), z.string().trim().regex(/^\d{8}$/, "código INEP: 8 dígitos")])
    .optional(),
  municipio: z.string().trim().max(120).optional(),
  uf: z.union([z.literal(""), z.string().trim().length(2).toUpperCase()]).optional(),
  paiId: z.union([z.literal(""), IdDeEscola]).optional(),
});

const EditarEscolaSchema = NovaEscolaSchema.partial().omit({ id: true, tipo: true });

const LotarSchema = z.object({
  usuarioId: z.string().uuid(),
  papel: z.enum(["professor", "gestor"]),
});

const TransferirSchema = z.object({
  escolaDestinoId: IdDeEscola,
  turmaDestinoId: z.string().uuid().optional(),
});

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
  @Roles("aluno", "professor", "gestor", "admin-contrato")
  minhas(@Req() req: Autenticado) {
    return this.escolas.escolasDaPessoa(req.auth.usuarioId);
  }

  @Get()
  @Roles("admin-contrato")
  listar(@Query("busca") busca?: string) {
    return this.escolas.listar(busca);
  }

  @Post()
  @Roles("admin-contrato")
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
  pessoas(@Param("id") id: string, @Query("papel") papel: string, @Req() req: Autenticado) {
    const escolaId = escolaAlvo(req.auth, id);
    const alvo = papel === "aluno" || papel === "gestor" ? papel : "professor";
    return this.escolas.pessoasDaEscola(escolaId, alvo);
  }

  /**
   * Lota alguém nesta escola. Para professor e gestor é ACRÉSCIMO: a lotação
   * que a pessoa tem em outra escola da rede continua valendo — é o caso que a
   * rede estadual tem aos milhares, e a razão de `lotacoes` existir.
   */
  @Post(":id/lotacoes")
  @Roles("gestor", "admin-contrato")
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

@Controller("alunos")
@UseGuards(OidcGuard, RolesGuard)
export class AlunosController {
  constructor(private readonly escolas: EscolasService) {}

  /**
   * Transferência entre escolas da rede.
   *
   * A escola de DESTINO é a de quem pede (o `escolaAlvo` cuida disso): é a
   * unidade que recebe a criança que a família matriculou nela. `admin-contrato`
   * pode mover para qualquer uma.
   *
   * O dado que o aluno produziu NÃO se move — continua com o `escola_id` da
   * escola onde aconteceu, que é verdade histórica. O que segue o aluno é a
   * identidade, e é o `historico` abaixo que a lê atravessada.
   */
  @Post(":id/transferir")
  @Roles("gestor", "admin-contrato")
  async transferir(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    if (!UUID.test(id)) throw new NotFoundException("aluno não encontrado");
    const dados = TransferirSchema.parse(body);
    const destino = escolaAlvo(req.auth, dados.escolaDestinoId);
    const feito = await this.escolas.transferirAluno({
      alunoId: id,
      escolaDestinoId: destino,
      turmaDestinoId: dados.turmaDestinoId ?? null,
    });
    if (!feito) throw new NotFoundException("aluno ou escola de destino não encontrada");
    return feito;
  }

  /**
   * O histórico do aluno ATRAVESSANDO escolas — a única leitura fora de
   * `admin-contrato` que faz isso.
   *
   * Só alcança quem tem lotação na escola ONDE O ALUNO ESTÁ HOJE: é a unidade
   * responsável por ele. Devolve participações (em que experiência, em que turma,
   * em que escola, quando), nunca o conteúdo dos instrumentos — o retrato de
   * valores da Vila e a transcrição do unooGPT continuam atrás das telas de quem
   * tem a posse pedagógica na escola onde aquilo aconteceu.
   */
  @Get(":id/historico")
  @Roles("professor", "gestor", "admin-contrato")
  async historico(@Param("id") id: string, @Req() req: Autenticado) {
    if (!UUID.test(id)) throw new NotFoundException("aluno não encontrado");
    const historico = await this.escolas.historicoDoAluno(id);
    if (!historico) throw new NotFoundException("aluno não encontrado");

    if (req.auth.perfil !== "admin-contrato") {
      const escolaAtual = historico.escolas.find((e) => e.atual)?.id;
      const podeVer =
        escolaAtual !== undefined && (await this.escolas.temLotacao(req.auth.usuarioId, escolaAtual));
      if (!podeVer) throw new ForbiddenException("este aluno não está numa escola sua");
    }
    return historico;
  }
}
