import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { map } from "rxjs/operators";
import type { Observable } from "rxjs";
import { CONTRATO_KEY, type OpcoesDoContrato } from "./contrato";

/**
 * Confere o que a rota devolveu contra o schema de resposta que ela declarou.
 *
 * Existe porque schema de saída é a parte do contrato que NÃO é exercida por
 * ninguém: o de entrada a api usa para validar em toda requisição, então ele não
 * tem como estar errado por muito tempo. O de saída é afirmação — e afirmação
 * que nada confere envelhece em silêncio, do mesmo jeito que a coluna
 * `expires_at` que ficou no schema depois que a rotina saiu do código.
 *
 * **Desligado em produção, e isso é a decisão, não uma economia.** Um schema
 * estrito demais transformaria uma rota que funciona num 500. Aqui ele só
 * observa: `safeParse`, aviso no log, resposta intacta. A conferência que DÓI é
 * a dos testes, com `.parse()` — esta serve para o desvio aparecer enquanto
 * alguém ainda está com o assunto na cabeça.
 */
@Injectable()
export class ContratoInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Contrato");
  private readonly ligado = process.env.NODE_ENV !== "production";

  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.ligado || ctx.getType() !== "http") return next.handle();

    const contrato = this.reflector.get<OpcoesDoContrato | undefined>(
      CONTRATO_KEY,
      ctx.getHandler(),
    );
    if (!contrato) return next.handle();

    const req = ctx.switchToHttp().getRequest<{ method: string; url: string }>();
    const rota = `${req.method} ${req.url}`;

    return next.handle().pipe(
      map((valor: unknown) => {
        this.conferir(contrato, valor, rota);
        return valor;
      }),
    );
  }

  private conferir(contrato: OpcoesDoContrato, valor: unknown, rota: string): void {
    // Resposta que não é JSON (o modelo de planilha sai em text/csv) não tem o
    // que conferir contra um schema de objeto.
    if (contrato.tipoDaResposta && contrato.tipoDaResposta !== "application/json") return;

    try {
      // Confere o que o CLIENTE recebe, não o que o service devolveu: aqui
      // ainda há `Date` do Prisma, e ele vira string só na serialização. Sem
      // esta volta pelo JSON, todo campo de data acusaria divergência falsa
      // contra um `z.string().datetime()` que está corretíssimo.
      const comoSai: unknown = JSON.parse(JSON.stringify(valor ?? null));
      const conferido = contrato.resposta.safeParse(comoSai);
      if (conferido.success) return;

      // SÓ caminho e código do problema. A mensagem do Zod embute o valor
      // recebido em alguns casos (`invalid_enum_value`), e a resposta desta api
      // carrega nome de criança e CPF — regra 6 do CLAUDE.md: nada de PII em
      // log, nem dentro de mensagem de erro.
      const problemas = conferido.error.issues
        .map((p) => `${p.path.join(".") || "(raiz)"}: ${p.code}`)
        .join("; ");
      this.logger.warn(`resposta fora do contrato em ${rota} — ${problemas}`);
    } catch {
      // Resposta que não sobrevive ao JSON (stream, Buffer, ciclo) não é caso
      // deste interceptor, e derrubar a requisição por causa da conferência
      // seria o oposto do que ele existe para fazer.
    }
  }
}
