import { Body, Controller, Get, HttpCode, HttpException, Post, Req, UseGuards } from "@nestjs/common";
import type { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  EstadoSchema,
  ForaSchema,
  GateDoEstudanteSchema,
  IniciarSchema,
  LupaSchema,
  ParesSchema,
  PublicarSchema,
  RespostaDaLupaSchema,
  RespostaDoPublicarSchema,
  RespostaDoToqueSchema,
  SegundaFotoSchema,
  SessaoSchema,
  ToqueSchema,
} from "./contrato-de-rotas";
import { EnigmaCapaService } from "./enigma-capa.service";
import { erroDeJogo } from "./erros";

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`exp02ef1b:${usuarioId}`, limite, 60_000);
  if (!r.ok) throw new HttpException({ mensagem: "Calma aí — muitas ações em pouco tempo." }, 429);
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const r = schema.safeParse(corpo);
  if (!r.success) throw erroDeJogo("payload-invalido");
  return r.data as z.output<S>;
}

const NOTA_DA_PORTA =
  "A porta da sala (ADR-69) e a disponibilidade (ADR-87) valem aqui: turma sem a missão liberada responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`).";
const NOTA_SEM_PACOTE = "Sem atividade no ar responde **409** `radio-em-preparo` — espera, não bloqueio.";
const NOTA_DO_PASSO =
  "Jogada à frente do passo: **409** `passo-invalido` (sem a sessão aberta pelo `iniciar`: `sessao-nao-aberta`). Repetir uma jogada já feita devolve o estado atual (200).";

/**
 * Rotas do ESTUDANTE da exp02ef1b — O Enigma da Capa da Rádio (ADR-184; a
 * revisão 2.0.0, ADR-186).
 *
 * O gabarito fica no servidor (regra 3): a tela manda o relato da lupa, a foto
 * e a posição, os toques; é o servidor que diz a fala da visitante, o que foi
 * acerto e o que ficou fora. A identidade — inclusive a
 * TURMA — sai do token e do banco. A guarda de liberação está no FUNIL do
 * service, não aqui.
 */
@Controller("enigma-capa")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class EnigmaCapaController {
  constructor(private readonly missao: EnigmaCapaService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão, a cena SEM o gabarito, a geometria, o material fixo e os textos.",
    descricao:
      "`passo` é DERIVADO no servidor: `inicio → lupa → decidir → feed → invariantes → slider → fora → pares → segunda-foto → concluida`. `inicio` é o card \"INVESTIGAR A NOVA CAPA\" (sem sessão); `feed` com a turma na fase `aberta` é a espera (\"AGUARDE O PROFESSOR\").\n\nA cena desce sem `nucleo`, sem a fala da visitante, sem a coerência dos selos, sem os alvos dos invariantes e sem os marcáveis. A exceção (ADR-186): com o passo `lupa`, os dois alvos descem em `lupa.alvos`, para o brilho da lente. Coordenadas em 0–100 da panorâmica 16:9.",
    resposta: SessaoSchema,
    notas: [NOTA_DA_PORTA, "Sem atividade no ar: `preparada: false`, `cena: null` e a tela é de espera."],
  })
  sessao(@Req() req: Autenticado) {
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId);
  }

  @Get("gate")
  @Contrato({
    resumo: "A fase da turma, a rodada e o passo do estudante (polling de 3 s).",
    descricao: "**Polling HTTP, nunca WebSocket** (ADR-93). A `fase` vira `virada` quando o professor toca em LIBERAR VIRADA; a `rodada` sobe quando ele zera.",
    resposta: GateDoEstudanteSchema,
    notas: [NOTA_DA_PORTA],
  })
  gate(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("iniciar")
  @HttpCode(200)
  @Contrato({
    resumo: "E1: ABRIR BANCADA — abre a sessão desta rodada (o passo vira `lupa`). Idempotente.",
    descricao: "Sem corpo (ou `{}`). A sessão já aberta devolve o estado (200).",
    corpo: IniciarSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE],
  })
  iniciar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    valida(IniciarSchema, corpo ?? {});
    return this.missao.iniciar(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("lupa")
  @HttpCode(200)
  @Contrato({
    resumo: "E2: o relato da lupa — e, com `avancar`, o piso.",
    descricao:
      "`alvo1Ms`/`alvo2Ms` = os ms com o centro da lente sobre cada um dos dois objetos do fundo (em qualquer das duas fotos). O servidor guarda o MÁXIMO de cada tempo, limitado ao tempo desde a entrada. Com `avancar: true`: 3 s em CADA um dos dois liberam o `decidir` (`liberado: true`); senão o alerta conta (`alerta: true`, 200) — a tela mostra \"OLHE O FUNDO\". Os alertas entram na régua da EF02CO05.",
    corpo: LupaSchema,
    resposta: RespostaDaLupaSchema,
    notas: [NOTA_DA_PORTA, NOTA_SEM_PACOTE, NOTA_DO_PASSO],
  })
  lupa(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.lupa(req.auth.escolaId, req.auth.usuarioId, valida(LupaSchema, corpo));
  }

  @Post("publicar")
  @HttpCode(200)
  @Contrato({
    resumo: "E3: PUBLICAR CAPA — o LATCH 1.",
    descricao:
      "Irreversível. O servidor deriva o retângulo que a moldura mostrou (`capa.visivel`) e a fala da VISITANTE: metade ou mais da ação da foto na capa dá a fala da foto (\"Na foto, vi crianças lendo!\"); senão, só o lugar (\"Na foto, vi a biblioteca!\").",
    corpo: PublicarSchema,
    resposta: RespostaDoPublicarSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "A mesma foto e o mesmo selo de novo são idempotentes; outra escolha é **409** `ja-publicado`."],
  })
  publicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { fotoId, seloId, deslocamento } = valida(PublicarSchema, corpo);
    return this.missao.publicar(req.auth.escolaId, req.auth.usuarioId, fotoId, seloId, deslocamento);
  }

  @Post("invariantes")
  @HttpCode(200)
  @Contrato({
    resumo: 'E4: um toque no "TOQUE EM 2 COISAS IGUAIS" — só depois da virada.',
    descricao:
      "`x`, `y` são da PANORÂMICA, dentro do recorte da foto tocada. Quatro acertos (2 objetos × 2 fotos) completam e marcam a **EF02CO01**. No 3º erro a AJUDA acende e os alvos descem em `toque.alvos` (o pulso amarelo).",
    corpo: ToqueSchema,
    resposta: RespostaDoToqueSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "Antes da virada: **409** `virada-nao-liberada`. Toque fora da foto: **400** `toque-fora-da-foto`."],
  })
  invariantes(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { fotoId, x, y } = valida(ToqueSchema, corpo);
    return this.missao.tocarInvariante(req.auth.escolaId, req.auth.usuarioId, fotoId, { x, y });
  }

  @Post("slider")
  @HttpCode(200)
  @Contrato({ resumo: "E4: o slider abriu a panorâmica. Idempotente.", resposta: EstadoSchema, notas: [NOTA_DA_PORTA, NOTA_DO_PASSO] })
  slider(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.abrirPanoramica(req.auth.escolaId, req.auth.usuarioId);
  }

  @Post("fora")
  @HttpCode(200)
  @Contrato({
    resumo: 'E4: "Marque n{espaço} o que ficou fora da sua foto." + "Pronto" — marca a EF02CO05.',
    descricao:
      "Os alfinetes (1 a 10, na panorâmica) viram os marcáveis que ficaram FORA da capa publicada. Marca a **EF02CO05** na mesma transação, com a lupa, o selo, os invariantes e o \"fora\" (ao menos um marcável fora da capa).",
    corpo: ForaSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO],
  })
  fora(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { toques } = valida(ForaSchema, corpo);
    return this.missao.marcarFora(req.auth.escolaId, req.auth.usuarioId, toques);
  }

  @Post("pares")
  @HttpCode(200)
  @Contrato({
    resumo: "E5: o par de fotos da mesma atividade e o motivo.",
    corpo: ParesSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "Carta desconhecida ou repetida: **400** `carta-desconhecida`. Só painel."],
  })
  pares(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { cartas, motivo } = valida(ParesSchema, corpo);
    return this.missao.formarPar(req.auth.escolaId, req.auth.usuarioId, cartas, motivo);
  }

  @Post("segunda-foto")
  @HttpCode(200)
  @Contrato({
    resumo: 'E5: a segunda foto — o elemento e a posição na moldura fixa ("Colocar no álbum"). Conclui a missão.',
    corpo: SegundaFotoSchema,
    resposta: EstadoSchema,
    notas: [NOTA_DA_PORTA, NOTA_DO_PASSO, "Só painel: o servidor registra se a criança lendo ficou na moldura. O passo vira `concluida`."],
  })
  segundaFoto(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { elemento, deslocamento } = valida(SegundaFotoSchema, corpo);
    return this.missao.segundaFoto(req.auth.escolaId, req.auth.usuarioId, elemento, deslocamento);
  }
}
