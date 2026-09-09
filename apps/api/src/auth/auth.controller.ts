import { Body, Controller, HttpCode, HttpException, Post } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { logger } from "../observabilidade/logger";
import { EscolasService } from "../rostering/escolas.service";
import type { Perfil } from "./claims";
import {
  LoginRespostaSchema,
  LoginSchema,
  TrocaRespostaSchema,
  TrocaSchema,
} from "./contrato-de-rotas";

const CREDENCIAIS_INVALIDAS = "Usuário ou senha incorretos.";

/**
 * Consumido pelo `authorize()` do NextAuth no hub — nunca pelo browser.
 * A api é a única dona do banco; o hub não conhece hash nenhum.
 *
 * Sem rate limit por IP de propósito: a api só enxerga o IP do hub. O limite
 * por usuário segura força bruta; o teto por rede da escola fica no hub.
 */
@Controller("auth")
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escolas: EscolasService,
  ) {}

  @Post("login")
  @HttpCode(200)
  @Contrato({
    resumo: "Autentica uma credencial da rede.",
    descricao:
      "Consumida pelo `authorize()` do NextAuth no hub — **nunca pelo navegador**. A api é a única dona do banco; o hub não conhece hash nenhum.\n\nDevolve as escolas em que a pessoa tem lotação ativa: professor de rede estadual tem mais de uma, e o token carrega UMA.",
    corpo: LoginSchema,
    resposta: LoginRespostaSchema,
    acesso: "publica",
    notas: [
      "Conta com `ativo = false` é recusada com a MESMA mensagem genérica de senha errada — dizer \"conta desativada\" confirmaria que o login existe.",
      "`username` é único por ESCOLA, não por contrato: a senha desambigua, e empate entre escolas é recusado.",
      "8 tentativas por minuto por usuário (429). Não há limite por IP: a api só enxerga o IP do hub.",
    ],
  })
  async login(@Body() body: unknown) {
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) throw new HttpException({ mensagem: CREDENCIAIS_INVALIDAS }, 400);
    const { username, password } = parsed.data;

    const cota = rateLimit(`login:${username.toLowerCase()}`, 8, 60_000);
    if (!cota.ok) {
      throw new HttpException(
        { mensagem: "Muitas tentativas. Aguarde um momento e tente de novo." },
        429,
      );
    }

    const user = await this.autenticar(username, password);
    if (!user) throw new HttpException({ mensagem: CREDENCIAIS_INVALIDAS }, 401);

    /**
     * As escolas da pessoa. Professor de rede estadual tem mais de uma, e o
     * token carrega UMA — a que ele escolher. O hub monta o seletor com esta
     * lista e a reconsulta para VALIDAR a troca antes de assinar um token com a
     * escola nova; sem isso, bastaria pedir uma escola qualquer.
     */
    const escolas = await this.escolas.escolasDaPessoa(user.id);

    return {
      escolas: escolas.map((e) => ({ id: e.id, nome: e.nome, papel: e.papel })),
      usuarioId: user.id,
      /** O login em si — a troca de senha precisa dele, e o hub não o tinha. */
      usuario: user.username,
      nome: user.displayName,
      papel: user.role as Perfil,
      /* O `gestor_regional` não tem `users.escola_id` (não há lotação principal
         a cachear): a escola inicial dele é a primeira da regional, que
         `escolasDaPessoa` já devolveu ordenada por nome. Sem este `??`, o token
         sairia sem escola e o `escolaAlvo` — que só isenta os perfis de
         contrato — recusaria toda rota dele com 403. */
      escolaId: user.escolaId ?? escolas[0]?.id ?? null,
      turmaId: user.turmaId,
      serie: user.turma?.serie ?? null,
      /**
       * Senha veio de uma importação ou de um reset e ainda não foi trocada.
       * O hub prende a pessoa em /trocar-senha enquanto isto for verdade — e
       * também recusa emitir token de experiência, senão bastaria digitar
       * /exp/... para pular a troca.
       */
      precisaTrocarSenha: user.senhaProvisoria,
    };
  }

  /**
   * Primeiro acesso: a senha do lote (ou a temporária do reset) vale uma vez.
   * Exige a senha atual — é o mesmo nível de prova do login, e por isso a rota
   * não precisa de token.
   */
  @Post("trocar-senha")
  @HttpCode(200)
  @Contrato({
    resumo: "Primeiro acesso: troca a senha provisória.",
    descricao:
      "A senha do lote (ou a temporária de um reset) vale uma vez. Exige a senha ATUAL — é o mesmo nível de prova do login, e por isso a rota não pede token.\n\nLimpa `senha_provisoria` (ADR-29). O hub refaz a sessão com a senha nova depois disto: o cookie antigo ainda diz \"precisa trocar\".",
    corpo: TrocaSchema,
    resposta: TrocaRespostaSchema,
    acesso: "publica",
    notas: [
      "A senha nova precisa ser diferente da atual (400).",
      "8 tentativas por minuto por usuário (429).",
    ],
  })
  async trocarSenha(@Body() body: unknown) {
    const parsed = TrocaSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { mensagem: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        400,
      );
    }
    const { username, senhaAtual, senhaNova } = parsed.data;

    const cota = rateLimit(`trocar-senha:${username.toLowerCase()}`, 8, 60_000);
    if (!cota.ok) {
      throw new HttpException({ mensagem: "Muitas tentativas. Aguarde um momento." }, 429);
    }

    const user = await this.autenticar(username, senhaAtual);
    if (!user) throw new HttpException({ mensagem: CREDENCIAIS_INVALIDAS }, 401);

    if (await bcrypt.compare(senhaNova, user.passwordHash)) {
      throw new HttpException({ mensagem: "A nova senha precisa ser diferente da atual." }, 400);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(senhaNova, 10),
        senhaProvisoria: false,
        senhaDefinidaEm: new Date(),
      },
    });
    return { ok: true };
  }

  /**
   * Username é único POR ESCOLA: o mesmo usuário pode existir em mais de uma
   * (contratos grandes). A senha desambigua; empate de senha entre escolas é
   * recusado — caso raro que o gestor resolve renomeando no CSV.
   */
  private async autenticar(username: string, password: string) {
    const candidatos = await this.prisma.user.findMany({
      where: { username, ativo: true },
      include: { turma: true },
    });

    // Sempre comparamos algo para não vazar existência de usuário pelo tempo.
    const aprovados = [];
    if (candidatos.length === 0) {
      await bcrypt.compare(password, HASH_DUMMY);
    } else {
      for (const u of candidatos) {
        if (await bcrypt.compare(password, u.passwordHash)) aprovados.push(u);
      }
    }

    if (aprovados.length > 1) {
      // Sem o username no log (regra 6): o que interessa operar é a FREQUÊNCIA do caso.
      logger.warn({ codigo: "auth.username-ambiguo", escolas: aprovados.length }, "username ambíguo entre escolas — negado");
      return null;
    }
    return aprovados[0] ?? null;
  }
}

// Hash real para o caminho "usuário não existe" custar o mesmo tempo do
// caminho "senha errada". A entrada é sorteada A CADA SUBIDA e descartada no
// mesmo instante: nada nunca é comparado contra ela, e uma constante no fonte
// só serviria para alguém enviá-la e cronometrar a resposta.
const HASH_DUMMY = bcrypt.hashSync(randomBytes(32).toString("hex"), 10);
