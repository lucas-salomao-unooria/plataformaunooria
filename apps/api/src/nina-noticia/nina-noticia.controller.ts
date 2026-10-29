import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  CampoSchema,
  CarimbosSchema,
  ConcluirSchema,
  EstadoSchema,
  FichaAbertaSchema,
  FiltroSchema,
  GatePublicoSchema,
  PedirPassoSchema,
  PrevisaoSchema,
  ReparoSchema,
  RespostaDaFichaSchema,
  RespostaDaRotinaSchema,
  RespostaDoConcluirSchema,
  RespostaDoFiltroSchema,
  RespostaDoReparoSchema,
  RespostaDosSelosSchema,
  RotinaSchema,
  SelosSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { NinaNoticiaService } from "./nina-noticia.service";

/**
 * Rotas do ESTUDANTE da exp03ef1b — Nina e a Notícia que Desapareceu.
 *
 * O gabarito fica no servidor (regra 3): a criança diz o que ESCOLHEU (a
 * caixa, a busca, os carimbos, a ficha montada, a ordem dos blocos) e a
 * correção sai daqui. Identidade, inclusive a TURMA, sai do token, nunca do
 * corpo. A guarda da sala (ADR-69) e a disponibilidade (ADR-87) estão no FUNIL
 * do service (`garantirSessao`): rota nova nasce protegida.
 */

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, teto = 120) {
  if (!rateLimit(`nina-noticia:${usuarioId}`, teto, 60_000).ok) throw erroDeJogo("muitas-requisicoes");
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

const turmaDo = (auth: AuthClaims): string | null => auth.turmaId ?? null;

const PORTA =
  "Missão não liberada na turma responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`, a rede desligou); sem atividade em andamento, **403** `atividade-nao-preparada`; estudante sem turma, **409** `sem-turma`; corpo fora do formato, **400** `payload-invalido`.";
const RELOGIO =
  "Turma pausada: **409** `turma-pausada` (nada se grava). Jogada além do portão liberado: **403** `etapa-nao-liberada`; fora do passo: **409** `passo-fora-de-ordem`. A professora zerou no meio: **409** `rodada-mudou` (recarregue a sessão).";

@Controller("nina-noticia")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class NinaNoticiaController {
  constructor(private readonly missao: NinaNoticiaService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão: o passo efetivo, o jornal e os blocos de cada etapa já alcançada.",
    descricao:
      "Boot da experiência e o F5. `passo` é o EFETIVO (min do gravado e do teto da etapa da turma); `aguardandoOProfessor` acende o overlay de espera. Cada bloco (`filtro`, `ficha`, `reparo`, `rotina`, `caso`, `fim`) só vem do passo dele em diante — `null` antes. Nenhum gabarito: nem o certo dos carimbos, nem a sequência da rotina, nem a regra do reparo. Reportagens (`rp-`), etiquetas (`et-`) e blocos (`bl-`) têm ids OPACOS desta sessão; os blocos descem embaralhados.",
    resposta: SessaoSchema,
    notas: ["`imagem.url` é `null` sem imagem: a tela desenha a ilustração local.", PORTA],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "O relógio da turma e o passo efetivo deste computador (polling de 3 s).",
    descricao:
      "Magra de propósito e sem escrita. Quando `pacoteId` ou `rodada` mudam, a tela recarrega a sessão. `pausada` congela todas as telas no overlay \"Momento de conversar com a turma!\".",
    resposta: GatePublicoSchema,
    notas: [PORTA],
  })
  gate(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("selos")
  @HttpCode(200)
  @Contrato({
    resumo: 'E1: os selos "Mesma feira" (tocar o cartaz na foto ampliada).',
    descricao: "Soma os selos às que já estavam. Com os três, o passo vai a `aposta` (a escolha). Depois da galeria, devolve os selos como estão.",
    corpo: SelosSchema,
    resposta: RespostaDosSelosSchema,
    notas: ["Id que a sessão não tem: **400** `reportagem-desconhecida`.", RELOGIO, PORTA],
  })
  selos(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { reportagens } = valida(SelosSchema, corpo);
    return this.missao.selos(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), reportagens);
  }

  @Post("previsao")
  @HttpCode(200)
  @Contrato({
    resumo: 'E2: "Travar Escolha" — o LATCH.',
    descricao:
      "Grava as notícias da caixa (ao menos uma) e leva o passo ao filtro — que só abre com o \"Liberar Filtro\" da professora: até lá, `aguardandoOProfessor`. Não é certo nem errado: é a previsão que a omissão vai confrontar.",
    corpo: PrevisaoSchema,
    resposta: EstadoSchema,
    notas: [
      "Caixa vazia: **409** `previsao-vazia`. A segunda (inclusive duas simultâneas): **409** `previsao-ja-travada`. Id desconhecido: **400** `reportagem-desconhecida`.",
      RELOGIO,
      PORTA,
    ],
  })
  previsao(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { itens } = valida(PrevisaoSchema, corpo);
    return this.missao.previsao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), itens);
  }

  @Post("filtro")
  @HttpCode(200)
  @Contrato({
    resumo: "E3: a busca do jornal por um campo e um valor da pastilha.",
    descricao:
      "Booleana sobre as fichas: só Onde = Pátio encontra (as duas do pátio — o telão, com Onde vazio, fica de fora) e leva o passo à omissão. Qualquer outra busca devolve zero (\"0 notícias encontradas\") e conta em `filtro_tentativas`. Depois da busca certa, buscar de novo só responde.",
    corpo: FiltroSchema,
    resposta: RespostaDoFiltroSchema,
    notas: ["Campo conhecido com valor fora da pastilha: **400** `valor-de-filtro-invalido`.", RELOGIO, PORTA],
  })
  filtro(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const lido = FiltroSchema.safeParse(corpo);
    if (!lido.success) {
      /* Campo conhecido com valor de fora da pastilha tem código próprio: a tela pede "Escolha um valor". */
      const campo = (corpo as { campo?: unknown } | null)?.campo;
      throw erroDeJogo(CampoSchema.safeParse(campo).success ? "valor-de-filtro-invalido" : "payload-invalido");
    }
    const { campo, valor } = lido.data;
    return this.missao.filtro(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), campo, valor);
  }

  @Post("ficha")
  @HttpCode(200)
  @Contrato({
    resumo: 'E4-01: "Inspecionar Ficha" — a ficha do telão aberta.',
    descricao:
      "Devolve a ficha do telão (Quem e Quando preenchidos, Onde VAZIO) e leva o passo aos carimbos. `dica: true` = o pulso de 15 s disparou antes de abrir. Marca a EF15CO08 (`inspecao`). Abrir de novo devolve a ficha sem marcar.",
    corpo: FichaAbertaSchema,
    resposta: RespostaDaFichaSchema,
    notas: [RELOGIO, PORTA],
  })
  ficha(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { dica } = valida(FichaAbertaSchema, corpo);
    return this.missao.ficha(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), dica);
  }

  @Post("carimbos")
  @HttpCode(200)
  @Contrato({
    resumo: "E4-02 (K1–K3) e E6-01 (K4–K6): os três carimbos de uma etapa.",
    descricao:
      "Uma vez por etapa e sem retorno de acerto. `e4` leva o passo ao reparo; `e6` grava no caso novo e marca a EF03CO01 (`carimbos`) com os seis — depois, `POST concluir`.",
    corpo: CarimbosSchema,
    resposta: EstadoSchema,
    notas: ["De novo: **409** `carimbos-ja-enviados`.", RELOGIO, PORTA],
  })
  carimbos(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { etapa, carimbos } = valida(CarimbosSchema, corpo);
    return this.missao.carimbos(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), etapa, carimbos);
  }

  @Post("reparo")
  @HttpCode(200)
  @Contrato({
    resumo: 'E4-03: o "Concluir" — a ficha do telão montada com as três etiquetas.',
    descricao:
      "Uma etiqueta por campo, as três. O servidor decide o desfecho: `sucesso` ⇔ Pátio no campo Onde (as outras posições são gravadas, não avaliadas). Os dois desfechos têm \"Continuar\" (`POST passo` com `ponte`). Marca a EF03CO03 (`reparo`) e a EF15CO01 (`previsao`).",
    corpo: ReparoSchema,
    resposta: RespostaDoReparoSchema,
    notas: [
      "A mesma etiqueta em dois campos: **409** `reparo-incompleto`; etiqueta de outra sessão: **400** `etiqueta-desconhecida`; de novo: **409** `reparo-ja-enviado`.",
      RELOGIO,
      PORTA,
    ],
  })
  reparo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { ficha } = valida(ReparoSchema, corpo);
    return this.missao.reparo(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), ficha);
  }

  @Post("passo")
  @HttpCode(200)
  @Contrato({
    resumo: 'Os avanços sem dado: "Confrontar e Aguardar Turma ▶" (→ ficha), e o "Continuar" do desfecho (→ ponte) e da ponte (→ rotina).',
    descricao:
      "`ficha` sai da omissão e espera o \"Liberar Inspeção\" (`aguardandoOProfessor`). Pedir de novo, ou um passo já passado, devolve o estado como está (a escada é de sentido único).",
    corpo: PedirPassoSchema,
    resposta: EstadoSchema,
    notas: ["Antes do passo de origem: **409** `passo-invalido`.", RELOGIO, PORTA],
  })
  passo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { para } = valida(PedirPassoSchema, corpo);
    return this.missao.pedirPasso(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), para);
  }

  @Post("rotina")
  @HttpCode(200)
  @Contrato({
    resumo: 'E5-01: "Testar Rotina" — os sete blocos na ordem da esteira.',
    descricao:
      "Cada teste completo conta uma tentativa. Inválida: `valida: false` (E5-SIS-01, \"A rotina não para.\"). Válida: a simulação (3 → 0, a ficha do Clube de Xadrez recebe a bandeira), o passo vai ao caso novo e marca a EF03CO02 (`rotina`). Testar depois da válida devolve a simulação sem contar.",
    corpo: RotinaSchema,
    resposta: RespostaDaRotinaSchema,
    notas: [
      "Menos de sete: **409** `rotina-incompleta`; id de outra sessão ou repetido: **400** `bloco-desconhecido` — nenhum dos dois conta tentativa.",
      RELOGIO,
      PORTA,
    ],
  })
  rotina(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { sequencia } = valida(RotinaSchema, corpo);
    return this.missao.rotina(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), sequencia);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "O fim (E6-03): grava a conclusão e devolve o Painel da Investigação.",
    descricao: "Exige os carimbos do caso novo. Idempotente em `fim`.",
    corpo: ConcluirSchema,
    resposta: RespostaDoConcluirSchema,
    notas: ["Sem os carimbos do caso: **409** `carimbos-pendentes`.", RELOGIO, PORTA],
  })
  concluir(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    valida(ConcluirSchema, corpo ?? {});
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }
}
