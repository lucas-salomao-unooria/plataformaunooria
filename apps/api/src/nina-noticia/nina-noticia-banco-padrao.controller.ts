import { Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { ImagensDoBancoPadraoDaExp03ef1bService } from "./banco-padrao-imagens.service";
import { GeracaoDoBancoPadraoSchema, ImagensDoBancoPadraoSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";

/**
 * As imagens do BANCO PADRÃO da exp03ef1b — só do `admin`. Não é dado de
 * turma nem de escola: o banco é o mesmo para todo contrato, e a imagem é
 * custo da plataforma (sem quota de professor; medida no painel de custos com
 * atribuição explícita). Classe separada para o `@Roles("admin")` ficar limpo.
 */
@Controller("nina-noticia/banco-padrao")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class NinaNoticiaBancoPadraoController {
  constructor(private readonly imagens: ImagensDoBancoPadraoDaExp03ef1bService) {}

  @Get("imagens")
  @Contrato({
    resumo: "As imagens do banco padrão: quantas existem, quais faltam e as URLs.",
    descricao:
      "**Só `admin`.** Oito: as quatro do pacote da Feira de Troca de Livros (`mural`, `portal`, `telao`, `cartaz`) e as quatro cenas fixas (`caso-a`, `caso-b`, `extra-1`, `extra-2`). O nome do arquivo é o hash do pedido — o mesmo da customização. O storage é o registro.",
    resposta: ImagensDoBancoPadraoSchema,
    notas: ["Professora e gestores respondem **403**."],
  })
  progresso() {
    return this.imagens.progresso();
  }

  @Post("imagens")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera as imagens que faltam no banco padrão — incremental e idempotente.",
    descricao:
      "**Só `admin`.** Até oito por chamada, quatro de cada vez. O que já existe não é gerado de novo; duas chamadas simultâneas recebem o mesmo trabalho. **Custo da plataforma**: sem quota de professor, medido no painel de custos no recurso `nina-noticia-banco-padrao`, perfil `admin`, sem escola.",
    resposta: GeracaoDoBancoPadraoSchema,
    notas: ["Professora e gestores respondem **403**.", "Rate limit: 20 chamadas por minuto, depois **429** `muitas-requisicoes`."],
  })
  gerar(@Req() req: { auth: AuthClaims }) {
    if (!rateLimit(`nina-noticia:banco-padrao-imagens:${req.auth.usuarioId}`, 20, 60_000).ok) {
      throw erroDeJogo("muitas-requisicoes");
    }
    return this.imagens.gerar();
  }
}
