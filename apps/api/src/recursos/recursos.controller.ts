import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Contrato } from "../openapi/contrato";
import { PrismaService } from "../prisma/prisma.service";
import { cadeiaDaEscola } from "../comum/disponibilidade";
import { PRODUTOS } from "./catalogo";
import { RecursosEfetivosSchema } from "./contrato-de-rotas";
import { linhasLegiveis, resolverExperiencia, resolverProduto } from "./regras";
import { ProdutoSchema } from "./catalogo";

/**
 * O QUE ESTÁ LIGADO PARA MIM (ADR-87).
 *
 * Leitura, para QUALQUER autenticado — e isso é decisão: saber que o Entre
 * Redes está ligado na sua rede não é dado sensível de ninguém, e o hub precisa
 * disto em toda página que mostra card de produto. A ESCRITA é outra coisa: ela
 * vive no painel da Unooria, restrita ao `admin` (ADR-88).
 *
 * Sem `@Roles`: os seis papéis leem. O escopo sai do TOKEN — o `escola_id` do
 * claim —, nunca de query, para não haver "me diga o que está ligado na escola
 * do vizinho".
 */
@Controller("recursos")
@UseGuards(OidcGuard)
export class RecursosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("efetivos")
  @Contrato({
    resumo: "O que está disponível para a escola do token.",
    descricao:
      "Resolve a cadeia escola → regional → contrato e aplica o TETO do produto. É daqui que o hub monta os cards do professor e decide o 404 das rotas de produto — **esconder o card é UX**; a porta é `exigirMissaoLiberada` / `DisponibilidadeGuard`, no servidor.",
    resposta: RecursosEfetivosSchema,
    notas: [
      "`produtos` traz SEMPRE os quatro, ligados ou não: um mapa que só lista o ligado obriga quem lê a saber a lista completa de cor.",
      "Perfil de contrato (`gestor_contrato`, `admin`) não tem escola no token, então a resposta é a do CONTRATO — a cadeia fica vazia e só as linhas de escopo-contrato valem.",
      "Não devolve `motivo` nem quem desligou: isso é conversa entre a Unooria e a rede, e vive no painel.",
    ],
  })
  async efetivos(@Req() req: { auth: AuthClaims }) {
    const { escolaId } = req.auth;

    /* Sem escola no token (perfil de contrato) a cadeia é VAZIA: valem só as
       linhas de escopo-contrato. Não é degradação — é a resposta certa para
       quem não está olhando uma escola. */
    const cadeia = escolaId ? await cadeiaDaEscola(this.prisma, escolaId) : [];

    const [linhasCruas, experiencias] = await Promise.all([
      this.prisma.disponibilidade.findMany({
        where: { OR: [{ escolaId: null }, { escolaId: { in: [...cadeia] } }] },
        select: { recursoId: true, escolaId: true, ligado: true, versaoFixa: true, motivo: true },
      }),
      this.prisma.experiencia.findMany({
        select: { expId: true, produto: true },
        orderBy: { expId: "asc" },
      }),
    ]);
    const linhas = linhasLegiveis(linhasCruas);

    const produtos = Object.fromEntries(
      PRODUTOS.map((produto) => {
        const efetivo = resolverProduto(linhas, produto, cadeia);
        return [produto, { ligado: efetivo.ligado, versao: null }];
      }),
    );

    const porExperiencia = Object.fromEntries(
      experiencias.map((e) => {
        const lido = ProdutoSchema.safeParse(e.produto);
        const efetivo = resolverExperiencia(
          linhas,
          e.expId,
          lido.success ? lido.data : null,
          cadeia,
        );
        return [e.expId, { ligado: efetivo.ligado, versao: efetivo.versaoFixa }];
      }),
    );

    return { produtos, experiencias: porExperiencia };
  }
}
