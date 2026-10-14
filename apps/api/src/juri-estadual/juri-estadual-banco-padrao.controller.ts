import { Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { ImagensDoBancoPadraoService } from "./banco-padrao-imagens.service";
import { GeracaoDoBancoPadraoSchema, ImagensDoBancoPadraoSchema } from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";

/**
 * As imagens do BANCO PADRÃO do Júri — só do `admin`, a conta da Unooria. Não é
 * dado de turma nem de escola: o banco é o mesmo para todo contrato, e a imagem
 * é custo da plataforma (sem quota de professor; medida no painel de custos).
 *
 * Classe separada da `JuriEstadualTurmasController` para o `@Roles("admin")`
 * ficar limpo: o professor e os gestores não têm rota aqui (403).
 */
@Controller("juri-estadual/banco-padrao")
@UseGuards(OidcGuard, RolesGuard)
@Roles("admin")
export class JuriEstadualBancoPadraoController {
  constructor(private readonly imagens: ImagensDoBancoPadraoService) {}

  @Get("imagens")
  @Contrato({
    resumo: "As imagens do banco padrão do Júri: quantas existem, quais faltam e as URLs.",
    descricao:
      "**Só `admin`.** Uma imagem por projeto do banco padrão (quarenta), com o MESMO nome determinístico da customização do professor — o hash da descrição da imagem do projeto. O storage é o registro: `faltam` são os projetos sem arquivo.\n\nO pacote `padrao` (`POST /juri-estadual/turmas/:turmaId/banco-padrao`, e o fallback sem cota do `gerar-conteudo`) leva na `midia` as que existem; o projeto sem imagem segue com a arte procedural da experiência.",
    resposta: ImagensDoBancoPadraoSchema,
    notas: ["Professor e gestores respondem **403**."],
  })
  progresso() {
    return this.imagens.progresso();
  }

  @Post("imagens")
  @HttpCode(200)
  @Contrato({
    resumo: "Gera as próximas imagens que faltam no banco padrão do Júri — incremental.",
    descricao:
      "**Só `admin`.** Cada chamada gera ATÉ QUATRO imagens que faltam (4:3), na ordem do banco, e devolve o progresso — repita enquanto `completo` for `false` e a chamada anterior tiver gerado alguma. `falharam` diz o que não saiu NESTA chamada.\n\n**Idempotente**: a imagem que já existe no storage não é gerada de novo. Duas chamadas simultâneas recebem o mesmo trabalho (lock de processo).\n\n**Custo da plataforma, sem quota de professor**: cada imagem passa pelo provider de IA e é medida no painel de custos (`/recursos/custos-de-ia`) no recurso `juri-estadual-banco-padrao`, perfil `admin`, sem escola.",
    resposta: GeracaoDoBancoPadraoSchema,
    notas: [
      "Professor e gestores respondem **403**.",
      "Rate limit por usuário: 20 chamadas por minuto, depois **429** `muitas-requisicoes`.",
    ],
  })
  gerar(@Req() req: { auth: AuthClaims }) {
    if (!rateLimit(`juri-estadual:banco-padrao-imagens:${req.auth.usuarioId}`, 20, 60_000).ok) {
      throw erroDeJogo("muitas-requisicoes");
    }
    return this.imagens.gerar();
  }
}
