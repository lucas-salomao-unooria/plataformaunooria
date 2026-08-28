import { z } from "zod";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import { CriarPlanoSchema, RenomearSchema, SalvarConteudoSchema } from "./catalogo";
import {
  ConteudoSalvoSchema,
  DisponiveisSchema,
  ListaDePlanosSchema,
  OkSchema,
  PlanoComConteudoSchema,
  PlanoCriadoSchema,
  PlanoSchema,
  RestauradoSchema,
} from "./contrato-de-rotas";
import { PlanosService } from "./planos.service";

/**
 * Rotas do PROFESSOR da exp-90-plano-de-aula. Identidade (professor, escola)
 * sempre do token — nunca do body. Posse checada em toda rota com id.
 */

type Autenticado = { auth: AuthClaims };

@Controller("planos")
@UseGuards(OidcGuard, RolesGuard)
@Roles("professor")
export class PlanosController {
  constructor(private readonly planos: PlanosService) {}

  /** Disciplinas/séries com material importado — alimenta os `Selection`. */
  @Get("referencias/disponiveis")
  @Contrato({
    resumo: "Disciplinas e séries que têm material curricular importado.",
    descricao:
      "Alimenta os seletores da exp-90. Vem com os rótulos prontos: a tela imprime o que o servidor mandou, em vez de manter um segundo dicionário que divergiria na primeira disciplina nova.",
    resposta: DisponiveisSchema,
  })
  disponiveis() {
    return this.planos.disponiveis();
  }

  @Get()
  @Contrato({
    resumo: "Os planos DESTE professor.",
    descricao: "Posse por `professor_id` em toda query — plano de aula é autoral.",
    resposta: ListaDePlanosSchema,
  })
  listar(@Req() req: Autenticado) {
    return this.planos.listar(req.auth.escolaId, req.auth.usuarioId);
  }

  /** 202: a geração corre em background; acompanhar por GET /planos/:id. */
  @Post()
  @HttpCode(202)
  @Contrato({
    resumo: "Pede a geração de um plano de aula.",
    descricao:
      "**202**: a geração corre em background (claim atômico na linha), e o cliente acompanha por `GET /planos/:id` até o status virar `pronto` ou `erro`.",
    corpo: CriarPlanoSchema,
    resposta: PlanoCriadoSchema,
    status: 202,
    notas: [
      "3 gerações por hora por professor: cada uma custa ~220k tokens só de prompt (currículo da rede + as 4 unidades do ano). Acima disso, **429** com `codigo: RATE_LIMIT`.",
      "O teto de saída é 64k tokens, não 32k: com o material real o gemini-2.5-flash era cortado e o professor recebia \"o plano ficou grande demais\" sem plano nenhum.",
      "Passa pelo `QuotaService` por PERFIL (`AI_DAILY_TOKEN_QUOTA_PER_PROFESSOR`).",
    ],
  })
  criar(@Body() body: unknown, @Req() req: Autenticado) {
    // Cada geração custa ~220k tokens de prompt: 3 por hora por professor é
    // generoso para uso real e barra um laço de cliques.
    const limite = rateLimit(`plano:gerar:${req.auth.usuarioId}`, 3, 60 * 60_000);
    if (!limite.ok) {
      throw new HttpException(
        {
          codigo: "RATE_LIMIT",
          mensagem: `Muitas gerações seguidas. Tente de novo em ${Math.ceil(limite.retryAfterSeconds / 60)} min.`,
        },
        429,
      );
    }
    const parsed = CriarPlanoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ mensagem: "Escolha a disciplina e a série." });
    }
    return this.planos.criar(req.auth.escolaId, req.auth.usuarioId, req.auth.perfil, parsed.data);
  }

  @Get(":id")
  @Contrato({
    resumo: "Um plano, com o conteúdo quando estiver pronto.",
    descricao: "É o alvo do polling que segue o 202 de `POST /planos`.",
    params: z.object({ id: z.string().uuid() }),
    resposta: PlanoComConteudoSchema,
    notas: [
      "`html: null` enquanto o status não for `pronto` — é assim que o cliente sabe que ainda deve continuar o polling.",
    ],
  })
  obter(@Param("id") id: string, @Req() req: Autenticado) {
    return this.planos.obter(req.auth.escolaId, req.auth.usuarioId, id);
  }

  /** O botão Salvar do editor. */
  @Put(":id/conteudo")
  @Contrato({
    resumo: "Salva o conteúdo editado pelo professor.",
    descricao:
      "Sobrescreve o `atual.html` no object storage PRIVADO. O `gerado.md` é imutável e continua lá — é o que `POST /planos/:id/restaurar` devolve.",
    params: z.object({ id: z.string().uuid() }),
    corpo: SalvarConteudoSchema,
    resposta: ConteudoSalvoSchema,
    notas: [
      "O HTML é sanitizado com allowlist antes de gravar.",
      "Teto de 1 MB: um plano anual tem 30–150 KB. Acima disso, **400**.",
    ],
  })
  salvar(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const parsed = SalvarConteudoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ mensagem: "O conteúdo está vazio ou grande demais (limite 1 MB)." });
    }
    return this.planos.salvarConteudo(req.auth.escolaId, req.auth.usuarioId, id, parsed.data.html);
  }

  @Patch(":id")
  @Contrato({
    resumo: "Renomeia o plano.",
    params: z.object({ id: z.string().uuid() }),
    corpo: RenomearSchema,
    resposta: PlanoSchema,
    notas: ["Título entre 3 e 160 caracteres; fora disso, **400**."],
  })
  renomear(@Param("id") id: string, @Body() body: unknown, @Req() req: Autenticado) {
    const parsed = RenomearSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ mensagem: "Título entre 3 e 160 caracteres." });
    return this.planos.renomear(req.auth.escolaId, req.auth.usuarioId, id, parsed.data.titulo);
  }

  @Post(":id/restaurar")
  @HttpCode(200)
  @Contrato({
    resumo: "Descarta a edição e volta ao plano gerado.",
    descricao:
      "O `gerado.md` é IMUTÁVEL de propósito: é o que torna esta rota possível. Sem ele, salvar por cima seria irreversível.",
    params: z.object({ id: z.string().uuid() }),
    resposta: RestauradoSchema,
  })
  restaurar(@Param("id") id: string, @Req() req: Autenticado) {
    return this.planos.restaurar(req.auth.escolaId, req.auth.usuarioId, id);
  }

  @Delete(":id")
  @Contrato({
    resumo: "Exclui o plano.",
    params: z.object({ id: z.string().uuid() }),
    resposta: OkSchema,
  })
  excluir(@Param("id") id: string, @Req() req: Autenticado) {
    return this.planos.excluir(req.auth.escolaId, req.auth.usuarioId, id);
  }
}
