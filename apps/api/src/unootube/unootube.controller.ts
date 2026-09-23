import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  EstadoComScoreSchema,
  EstadoSchema,
  RankingSchema,
  SalvarSchema,
  SessaoSchema,
  VideoIdSchema,
} from "./contrato-de-rotas";
import { UnootubeService } from "./unootube.service";

/**
 * Rotas do ESTUDANTE da exp04ef1b. O gabarito (`factual`) fica no servidor:
 * o cliente manda a escolha, a api corrige e devolve inscritos/fontes
 * (regra inviolável nº 3). Identidade sempre do token, nunca do body.
 */

type Autenticado = { auth: AuthClaims };

function videoIdOu400(bruto: unknown): string {
  const parsed = VideoIdSchema.safeParse(bruto);
  if (!parsed.success) {
    throw new BadRequestException({
      codigo: "VIDEO_DESCONHECIDO",
      mensagem: "Esse vídeo não está mais disponível.",
    });
  }
  return parsed.data;
}

/** Por usuário, nunca por IP (a turma inteira sai pelo mesmo NAT da escola). */
function limitar(usuarioId: string) {
  const r = rateLimit(`unootube:${usuarioId}`, 120, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
  }
}

@Controller("unootube")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class UnootubeController {
  constructor(private readonly unootube: UnootubeService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão e o catálogo de vídeos.",
    descricao:
      "O catálogo sai **sem `factual`** — o tipo do servidor é `Omit<Video, \"factual\">`, então o gabarito é impossível de vazar aqui, não só ausente por descuido.",
    resposta: SessaoSchema,
    notas: [
      "As métricas de popularidade são COSMÉTICAS: nenhuma entra em conta nenhuma. O vídeo fake é o que tem os números grandes, e é esse contraste que o ranking desmonta.",
      "`ranking: null` até ele ser desbloqueado — é a virada da missão.",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.unootube.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("salvos")
  @HttpCode(200)
  @Contrato({
    resumo: "Salva um vídeo na playlist.",
    descricao:
      "A api corrige contra o `factual` e devolve inscritos e fontes recalculados no servidor (regra 3) — o cliente manda só qual vídeo salvou.",
    corpo: SalvarSchema,
    resposta: EstadoSchema,
    notas: [
      "A playlist tem 3 lugares. Cheia, a api recusa — é o diálogo de limite da experiência.",
      "Vídeo fora do catálogo é **400** com `codigo: VIDEO_DESCONHECIDO`.",
    ],
  })
  salvar(@Body() body: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const parsed = SalvarSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        codigo: "VIDEO_DESCONHECIDO",
        mensagem: "Esse vídeo não está mais disponível.",
      });
    }
    return this.unootube.salvar(req.auth.escolaId, req.auth.usuarioId, parsed.data.videoId);
  }

  /** POST explícito em vez de DELETE: a SDK só expõe get/post; semântica idempotente igual. */
  @Post("salvos/:videoId/remover")
  @HttpCode(200)
  @Contrato({
    resumo: "Tira um vídeo da playlist.",
    descricao:
      "`POST` em vez de `DELETE` porque a SDK só expõe get/post — a semântica idempotente é a mesma.",
    params: z.object({ videoId: VideoIdSchema }),
    resposta: EstadoSchema,
  })
  remover(@Param("videoId") videoId: string, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.remover(req.auth.escolaId, req.auth.usuarioId, videoIdOu400(videoId));
  }

  @Post("curtidos/:videoId")
  @HttpCode(200)
  @Contrato({
    resumo: "Curte (ou descurte) um vídeo.",
    params: z.object({ videoId: VideoIdSchema }),
    resposta: EstadoSchema,
    notas: ["Curtir não conta para nada na missão: o que vale é o que a criança SALVA."],
  })
  curtir(@Param("videoId") videoId: string, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.curtir(req.auth.escolaId, req.auth.usuarioId, videoIdOu400(videoId));
  }

  @Get("ranking")
  @Contrato({
    resumo: "O ranking — a virada da missão.",
    descricao:
      "Os colegas são **fictícios**: ranquear colegas reais exporia pontuação de menores (regra 6). `voce` marca a linha do estudante.\n\nÉ aqui que a popularidade que o feed exibia se desmancha: o vídeo de números grandes era o falso.",
    resposta: RankingSchema,
  })
  ranking(@Req() req: Autenticado) {
    return this.unootube.ranking(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("credibilidade")
  @HttpCode(200)
  @Contrato({
    resumo: "Fecha a missão trocando inscritos por credibilidade.",
    descricao:
      "É a única rota que acrescenta `score`, e ele é `derivados.fontesConfiaveis` — a correção server-side. É o valor que a experiência devolve ao hub no `exp:concluir`.",
    resposta: EstadoComScoreSchema,
  })
  credibilidade(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.credibilidade(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("reiniciar")
  @HttpCode(200)
  @Contrato({
    resumo: "Começa a missão do zero.",
    resposta: EstadoSchema,
  })
  reiniciar(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.unootube.reiniciar(req.auth.escolaId, req.auth.usuarioId);
  }
}
