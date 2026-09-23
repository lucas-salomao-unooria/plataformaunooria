import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthClaims } from "../auth/claims";
import { PrismaService } from "../prisma/prisma.service";
import { exigirRecursoDisponivel } from "./disponibilidade";

/**
 * A PORTA DAS FERRAMENTAS DE PROFESSOR (ADR-87).
 *
 * As experiências de ESTUDANTE não precisam disto: todas passam por
 * `exigirMissaoLiberada`, que já checa disponibilidade num ponto só. As três
 * ferramentas de professor (app-90, app-91, app-92) não têm liberação por
 * turma — e têm 28 rotas entre elas. Anotar rota por rota é o desenho em que a
 * 29ª nasce sem guarda, sem erro e sem sintoma: o produto simplesmente não
 * desliga, e ninguém descobre até tentar desligá-lo num incidente.
 *
 * Aqui a cobertura é por CLASSE e a exceção é DECLARADA — o mesmo desenho da
 * trilha do hub, em que a página só pode melhorar o que o layout já garantiu.
 *
 *   @Controller("bemestar")
 *   @UseGuards(OidcGuard, RolesGuard, DisponibilidadeGuard)
 *   @Roles("professor")
 *   @Recurso("app-91-bem-estar")
 *   export class BemEstarController { ... }
 *
 * Lê as tabelas fora de transação de tenancy de propósito: `disponibilidades`,
 * `experiencias` e `escolas` estão todas FORA da RLS (é configuração da rede,
 * não dado de estudante), então não há contexto a abrir — e abrir um aqui, num
 * guard que roda antes do interceptor, é que seria a surpresa.
 */

export const RECURSO_KEY = "recurso-da-rota";

/** Declara de que experiência esta classe (ou rota) é a superfície. */
export const Recurso = (expId: string) => SetMetadata(RECURSO_KEY, expId);

export const SEM_DISPONIBILIDADE_KEY = "sem-disponibilidade";

/**
 * Escapa a rota do interruptor. **Só para APAGAR os próprios dados.**
 *
 * Desligar um produto fecha tudo — é isso que o interruptor significa, e é o que
 * um incidente exige. A única exceção é apagar o que já existe: "não consigo
 * apagar meus dados porque o produto foi desligado" é indefensável, e mais ainda
 * no check-in de bem-estar, que é DASS-21 e dado sensível. Um interruptor nunca
 * pode prender dado de ninguém.
 *
 * Não use isto para leitura, edição ou exportação: fechar essas é a decisão, e
 * quem quiser recortá-la muda a ADR-87, não acrescenta um escape aqui.
 */
export const SemDisponibilidade = () => SetMetadata(SEM_DISPONIBILIDADE_KEY, true);

@Injectable()
export class DisponibilidadeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const escapa = this.reflector.getAllAndOverride<boolean | undefined>(
      SEM_DISPONIBILIDADE_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (escapa) return true;

    const expId = this.reflector.getAllAndOverride<string | undefined>(RECURSO_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    /* LANÇA em vez de liberar. Guard montado sem `@Recurso` é erro de
       programação, e o modo de falhar de "liberar em silêncio" é justamente o
       que este arquivo existe para impedir: o produto deixa de poder ser
       desligado e nada acusa. 500 na primeira requisição é o retorno certo. */
    if (!expId) {
      throw new ForbiddenException(
        "DisponibilidadeGuard sem @Recurso: declare de que experiência esta rota é a superfície",
      );
    }

    const auth = ctx.switchToHttp().getRequest<{ auth?: AuthClaims }>().auth;
    if (!auth) throw new ForbiddenException("Rota com DisponibilidadeGuard sem OidcGuard antes");

    /* Perfil de contrato não tem escola no token (regra inviolável nº 1), logo
       não há escopo a resolver. Deixa passar — quem barra esses papéis nas
       ferramentas de professor é o `RolesGuard`, e duplicar a decisão aqui faria
       duas respostas para a mesma pergunta. */
    if (!auth.escolaId) return true;

    await exigirRecursoDisponivel(this.prisma, auth.escolaId, expId);
    return true;
  }
}
