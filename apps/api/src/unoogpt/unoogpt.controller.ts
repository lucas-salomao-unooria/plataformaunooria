import { Body, Controller, Get, Post, Put, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { erroDeJogo } from "./erros";
import { PASSOS } from "./regras/passos";
import {
  BAIRROS_VALIDOS,
  CONJUNTOS_VALIDOS,
  JUSTIFICATIVAS_VALIDAS,
  UnoogptService,
} from "./unoogpt.service";

/**
 * As rotas do ALUNO na Missão Tempestade.
 *
 * Note o que NÃO existe aqui: id de sessão. No projeto de origem toda rota era
 * `/api/missao/:id/*` e havia a guarda `donoDaSessao` para provar a posse; aqui
 * a identidade é `(escola, aluno)` vinda do TOKEN, e não há como pedir a sessão
 * de outra pessoa. A guarda desapareceu junto com a classe de bug que ela
 * protegia.
 *
 * Zod em TODO input externo, declarado aqui e nunca no service. Rate limit por
 * USUÁRIO, nunca por IP: a turma inteira sai pelo mesmo NAT da escola.
 */
@Controller("unoogpt")
@UseGuards(OidcGuard, RolesGuard)
@Roles("aluno")
export class UnoogptController {
  constructor(private readonly service: UnoogptService) {}

  /**
   * Quem está falando. Vem SÓ do token — nunca do corpo da requisição: aceitar
   * `alunoId` do cliente seria deixar uma aba pedir a partida de outra pessoa.
   */
  private quem(req: { auth: AuthClaims }) {
    const { usuarioId, escolaId, perfil } = req.auth;
    // Aluno sem escola não existe: escola vazia é exclusividade do
    // admin-contrato, e ele não joga.
    if (!escolaId) throw erroDeJogo("sessao-encerrada");
    return { alunoId: usuarioId, escolaId, perfil };
  }

  private valida<T>(schema: z.ZodType<T>, corpo: unknown): T {
    const r = schema.safeParse(corpo);
    if (!r.success) throw erroDeJogo("payload-invalido");
    return r.data;
  }

  /** O bootstrap da tela. Cria a sessão na primeira visita. */
  @Get("sessao")
  async sessao(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    return this.service.sessao(escolaId, alunoId);
  }

  /** Polling do relógio da turma (~5s). Leve: sem IA, sem mapa. */
  @Get("relogio")
  async relogio(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    rateLimit(`unoogpt:relogio:${alunoId}`, 240, 60_000);
    return this.service.relogio(escolaId, alunoId);
  }

  /**
   * O turno do Cientista — a rota que fala com o modelo.
   *
   * Rate limit apertado (12/min) porque cada chamada custa tokens de verdade: o
   * teto por sessão é o controle de custo, e este é o freio contra o laço.
   */
  @Post("pergunta")
  async pergunta(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId, perfil } = this.quem(req);
    // 600 caracteres: o campo do chat, não um formulário. Acima disso não é
    // fala de aluno — é colagem, e ela infla o prompt de todo turno seguinte.
    const { texto } = this.valida(z.object({ texto: z.string().trim().min(1).max(600) }), corpo);
    rateLimit(`unoogpt:pergunta:${alunoId}`, 12, 60_000);
    return this.service.pergunta(escolaId, alunoId, perfil, texto);
  }

  /** Carregar fontes pelo painel. `PUT`: é atribuição de conjunto. */
  @Put("conjuntos")
  async conjuntos(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const { conjuntos } = this.valida(
      z.object({ conjuntos: z.array(z.enum(CONJUNTOS_VALIDOS)).min(1).max(8) }),
      corpo,
    );
    rateLimit(`unoogpt:conjuntos:${alunoId}`, 60, 60_000);
    return this.service.carregarConjuntos(escolaId, alunoId, conjuntos);
  }

  /** Alocar pelo mapa. `bairro: null` tira a equipe do destino. */
  @Post("alocacao")
  async alocacao(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const dados = this.valida(
      z.object({
        equipe: z.enum(["alfa", "bravo"]),
        bairro: z.enum(BAIRROS_VALIDOS).nullable(),
        // Ausente e explicitamente nula são a MESMA coisa aqui — "escolhi o
        // bairro, ainda não disse por quê". O portão que exige o porquê é o de
        // ENVIAR, não o de escolher no mapa.
        justificativa: z.enum(JUSTIFICATIVAS_VALIDAS).nullish(),
      }),
      corpo,
    );
    rateLimit(`unoogpt:alocacao:${alunoId}`, 60, 60_000);
    return this.service.alocar(
      escolaId,
      alunoId,
      dados.equipe,
      dados.bairro,
      dados.justificativa ?? null,
    );
  }

  /** Enfrentar a tempestade. Exige justificativa de cada equipe com destino. */
  @Post("simular")
  async simular(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    rateLimit(`unoogpt:simular:${alunoId}`, 20, 60_000);
    return this.service.simular(escolaId, alunoId);
  }

  @Get("resultado")
  async resultado(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    return this.service.resultado(escolaId, alunoId);
  }

  /** "E se eu tivesse mandado para…". Não grava e não debita. */
  @Post("contrafactual")
  async contrafactual(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const dados = this.valida(
      z.object({
        alfa: z.enum(BAIRROS_VALIDOS).nullable(),
        bravo: z.enum(BAIRROS_VALIDOS).nullable(),
      }),
      corpo,
    );
    rateLimit(`unoogpt:contrafactual:${alunoId}`, 40, 60_000);
    return this.service.contrafactual(escolaId, alunoId, dados);
  }

  @Post("passo")
  async passo(@Req() req: { auth: AuthClaims }, @Body() corpo: unknown) {
    const { escolaId, alunoId } = this.quem(req);
    const { para } = this.valida(z.object({ para: z.enum(PASSOS) }), corpo);
    return this.service.irParaPasso(escolaId, alunoId, para);
  }

  /** Recomeçar abre tentativa NOVA — não apaga a conversa anterior. */
  @Post("reiniciar")
  async reiniciar(@Req() req: { auth: AuthClaims }) {
    const { escolaId, alunoId } = this.quem(req);
    rateLimit(`unoogpt:reiniciar:${alunoId}`, 10, 60_000);
    return this.service.reiniciar(escolaId, alunoId);
  }
}

/** Exportado só para o teste conferir que nenhuma rota nova escapou do Zod. */
export const ROTAS_DO_ALUNO = [
  "sessao",
  "relogio",
  "pergunta",
  "conjuntos",
  "alocacao",
  "simular",
  "resultado",
  "contrafactual",
  "passo",
  "reiniciar",
] as const;
