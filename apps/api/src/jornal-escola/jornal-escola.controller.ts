import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  AbrirPistaSchema,
  ChaveMontadaSchema,
  ChaveSchema,
  ComparativoSchema,
  DiagramacaoSchema,
  DiagramarSchema,
  EstadoSchema,
  GatePublicoSchema,
  JulgamentoSchema,
  JulgarSchema,
  MotivoSchema,
  PedirPassoSchema,
  PistaReveladaSchema,
  PublicarSchema,
  ResultadoSchema,
  RevisaoSchema,
  SessaoSchema,
  SimulacaoDaTelaSchema,
  SimulacaoEnviadaSchema,
  SimularSchema,
  TransferenciaDaTelaSchema,
  TransferenciaEnviadaSchema,
  TransferirSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { JornalEscolaService } from "./jornal-escola.service";

/**
 * Rotas do ESTUDANTE da exp04ef1b — Jornal da Escola: A Edição de Bento.
 *
 * O gabarito fica no servidor: o cliente diz QUAIS três notícias pôs na página,
 * e quantas estão verificadas, o que cada uma causou e o pilar que faltava
 * saem daqui, cada um no seu portão (regra inviolável nº 3). Identidade,
 * inclusive a TURMA, sai do token, nunca do corpo.
 *
 * A guarda de liberação (ADR-69) está no FUNIL do service (`garantirSessao`),
 * não aqui: rota nova nasce protegida sem ninguém lembrar de protegê-la.
 */

type Autenticado = { auth: AuthClaims };

/**
 * Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. E o
 * 429 FREIA — lança, com o código, como todo erro desta missão.
 */
function limitar(usuarioId: string, teto = 120) {
  const r = rateLimit(`jornal-escola:${usuarioId}`, teto, 60_000);
  if (!r.ok) throw erroDeJogo("muitas-requisicoes");
}

function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

const PORTA =
  "Missão não liberada na turma responde **403** `missao-nao-liberada` (ou `recurso-indisponivel`). Estudante sem turma responde **409** `sem-turma`. Corpo fora do formato responde **400** `payload-invalido`.";

@Controller("jornal-escola")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class JornalEscolaController {
  constructor(private readonly missao: JornalEscolaService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão e as 8 notícias da mesa, sem o gabarito.",
    descricao:
      "Boot da experiência e o F5. As notícias saem **na ordem da mesa** e **sem `gabarito`, `pistas` e `consequencia`** — a notícia pública é uma allowlist no servidor. O texto das pistas desce no `POST /jornal-escola/pista` (é o registro que mede a EF15CO04), e o F5 devolve as já abertas em `pistasAbertas`.\n\n**A missão não nasce vazia**: sem homologação, a turma roda o banco padrão (\"Feira de Ciências e Notícias da Cidade\"), e o pacote `padrao` nasce na primeira entrada. `imagem.url` é SÓ a imagem que o professor aprovou (ADR-147): `null` para a que foi trocada e espera o novo OK — a tela desenha esse cartão pelo meio.\n\n`blocos` (os seis da Chave do Editor, na ordem da bandeja DESTA sessão, estável num F5) é `null` até a revisão abrir para esta criança. Nenhum bloco diz se é pilar ou isca.",
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o gravado. A etapa só conduz quem publicou a 1ª edição e respondeu o motivo.",
      "`pacoteId` é a ATIVIDADE e `rodada` é a rodada dela: mudam quando o professor homologa outro pacote ou zera a turma, e a sessão é outra.",
      PORTA,
    ],
  })
  sessao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está (polling de ~5 s).",
    descricao:
      "Magra de propósito (ADR-93): sem notícias, sem contagem da sala, sem JOIN. **Polling HTTP, nunca WebSocket.** `agora` é o instante do SERVIDOR.",
    resposta: GatePublicoSchema,
    notas: [
      "Passa pelo MESMO funil de liberação das outras rotas (ADR-69 e ADR-87): turma sem a missão liberada recebe 403 em vez de descobrir a etapa.",
      "Não escreve nada. `rodada` e `pacoteId` são `null` só antes da primeira entrada da turma; quando mudam, a tela recarrega a sessão.",
    ],
  })
  gate(@Req() req: Autenticado) {
    // 240/min cobre os 12 pedidos por minuto do intervalo de 5 s com folga
    // para uma reconexão.
    limitar(req.auth.usuarioId, 240);
    return this.missao.gate(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("passo")
  @HttpCode(200)
  @Contrato({
    resumo: "Registra o passo que a própria criança deu: a mesa, ou a simulação da Chave.",
    descricao:
      "`mesa` vale do desafio (\"Explorar Mesa de Notícias\"); pedir de novo, ou depois da 1ª publicação, devolve o passo em que ela está — a escada é de sentido único. `simulacao` é o \"Testar a minha Chave\", só do comparativo. A rodada da 2.x, sem Chave MONTADA, vai direto à `transferencia`.",
    corpo: PedirPassoSchema,
    resposta: EstadoSchema,
    notas: ["`simulacao` antes do comparativo responde **409** `passo-invalido`.", PORTA],
  })
  passo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { para } = valida(PedirPassoSchema, corpo);
    return this.missao.pedirPasso(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), para);
  }

  @Post("pista")
  @HttpCode(200)
  @Contrato({
    resumo: "Abre uma pista (fonte, data ou autoria) de uma notícia — o texto vem do servidor.",
    descricao:
      "O texto da pista desce AQUI, e não na sessão: o registro de quem abriu o quê é o que o `POST julgamento` exige antes de julgar, e a metade do `edicao-2` da EF04CO08 — uma pista lida sem registro seria evidência que a plataforma não vê.\n\nSó na mesa da 1ª edição (fase 1) e na mesa de revisão (fase 2). Idempotente por par na mesma fase: abrir de novo devolve o mesmo texto e não conta.",
    corpo: AbrirPistaSchema,
    resposta: PistaReveladaSchema,
    notas: [
      "Fora da mesa e da revisão responde **409** `passo-invalido`.",
      "`fase` diz onde a pista foi aberta (1 = mesa, 2 = revisão); `abertas` conta os pares (notícia, tipo) distintos das duas fases. No `pistasAbertas` da sessão, o par aberto nas duas fases aparece duas vezes.",
      PORTA,
    ],
  })
  pista(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const par = valida(AbrirPistaSchema, corpo);
    return this.missao.abrirPista(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), par);
  }

  @Post("julgamento")
  @HttpCode(200)
  @Contrato({
    resumo: "\"Confio / Não confio\" numa pista já aberta — o registro da EF15CO04.",
    descricao:
      "Logo depois de abrir a pista e ANTES de decidir a capa (o plenário pôs o julgamento antes da decisão). Opcional: a pista aberta e não julgada só não conta. O PRIMEIRO julgamento de cada (notícia, pista) vale; o segundo devolve o gravado, com `novo: false`. A EF15CO04 é marcada na 1ª publicação, sobre estes julgamentos e a capa publicada.",
    corpo: JulgarSchema,
    resposta: JulgamentoSchema,
    notas: [
      "Fora da mesa da 1ª edição responde **409** `passo-invalido`; pista sem abertura registrada, **409** `pista-nao-aberta`.",
      PORTA,
    ],
  })
  julgamento(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const j = valida(JulgarSchema, corpo);
    return this.missao.julgar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), j);
  }

  @Post("diagramar")
  @HttpCode(200)
  @Contrato({
    resumo: "Diagrama a primeira página com as 3 vagas de agora — a IA só escolhe o layout.",
    descricao:
      "A IA atua na diagramação, não na decisão editorial (PDF §5): recebe das três notícias só a manchete, o tamanho do resumo e se há imagem, como DADO, e escolhe UM dos layouts do DS (`classic`, `hero-image`, `columns`). Não escreve texto, não troca a ordem das vagas e nunca vê o gabarito.\n\n**Nunca falha por causa da IA**: cache da mesma página → IA (teto de ~6 s, quota do estudante, rate limit) → o modelo automático, determinístico, com `origem: \"modelo\"`. Em dev e na e2e é sempre o modelo.",
    corpo: DiagramarSchema,
    resposta: DiagramacaoSchema,
    notas: [
      "`slots`: exatamente 3 ids diferentes, de `n1` a `n8`, na ordem das vagas (a primeira é a manchete principal). (Os `.refine()` somem do OpenAPI; daí esta nota.)",
      "Fora da mesa e da revisão responde **409** `passo-invalido`.",
      PORTA,
    ],
  })
  diagramar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { slots } = valida(DiagramarSchema, corpo);
    return this.missao.diagramar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), slots);
  }

  @Post("publicar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Distribuir Jornal Agora" — a 1ª edição (latch).',
    descricao:
      "O gesto que a missão mede, e ele é IRREVERSÍVEL. A api calcula as verificadas AQUI, contra o gabarito do pacote (o cliente só manda os três ids), e grava vagas, layout, carimbo e o passo `motivo` juntos. **A resposta não traz o resultado**: ele só desce no `GET /jornal-escola/resultado`, depois do motivo e com o portão do professor aberto.\n\nMarca a EF15CO04 (`julgamentos`) pelos \"confio / não confio\" da mesa e pela coerência da capa publicada.",
    corpo: PublicarSchema,
    resposta: EstadoSchema,
    notas: [
      "`slots`: exatamente 3 ids diferentes, de `n1` a `n8`. `layout` e `origemDoLayout` são o que a tela desenhou (o `POST diagramar`): cosméticos, não valem na correção.",
      "Segunda publicação — inclusive duas simultâneas — responde **409** `edicao-ja-publicada`. Do desafio, **409** `passo-invalido`. Com a rodada trocada no meio (o professor zerou), **409** `rodada-mudou`.",
      PORTA,
    ],
  })
  publicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const pub = valida(PublicarSchema, corpo);
    return this.missao.publicar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), pub);
  }

  @Post("motivo")
  @HttpCode(200)
  @Contrato({
    resumo: "Como a escolha foi feita — a pergunta de depois do latch, uma vez só.",
    descricao:
      "`visual` (\"as fotos mais chamativas e os avisos mais urgentes\") ou `checagem` (\"quem postou, quando aconteceu e quem assina\"). Vem DEPOIS da publicação (perguntar antes anteciparia a descoberta, PDF §4) e ANTES do resultado, com qualquer etapa: a resposta não pode sair contaminada pela consequência.",
    corpo: MotivoSchema,
    resposta: EstadoSchema,
    notas: [
      "Antes da 1ª publicação responde **409** `edicao-nao-publicada`; a segunda resposta, **409** `motivo-ja-respondido`.",
      PORTA,
    ],
  })
  motivo(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { motivo } = valida(MotivoSchema, corpo);
    return this.missao.responderMotivo(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), motivo);
  }

  @Get("resultado")
  @Contrato({
    resumo: "O que a 1ª edição causou: as verificadas e a reação de um leitor por vaga.",
    descricao:
      "\"X de 3 notícias verificadas nesta edição (Y%)\" — 0, 33, 67 ou 100, descrevendo a SELEÇÃO, não a criança (PDF §6). As reações são só das notícias efetivamente escolhidas (PDF §7), uma por vaga, com o humor do balão derivado de a notícia ser publicável. Não diz quais notícias trocar: isso é da revisão.",
    resposta: ResultadoSchema,
    notas: [
      "Sem publicação responde **409** `edicao-nao-publicada`; sem o motivo, **409** `motivo-pendente`; antes do portão do professor (etapa `exploracao`), **409** `resultado-nao-liberado`.",
      PORTA,
    ],
  })
  resultado(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.resultado(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("chave")
  @HttpCode(200)
  @Contrato({
    resumo: "A Chave do Editor MONTADA — um envio, sem correção (3.0.0).",
    descricao:
      "Três vagas — o bloco (entre seis: três pilares e três iscas), o lado de cada um dos dois cartões de condição dele (`aprova`/`reprova`, na ordem canônica `<bloco>-1`, `<bloco>-2`) e o \"se esta pista falhar\" (`parar` = \"Não publico\", `seguir` = \"Olho a próxima pista\") — e a repetição (`todas` / `so_a_primeira`). **Não há correção nem nova tentativa**, e a resposta não diz se a Chave está certa: o lado certo dos cartões nunca desce ao bundle. Grava a montagem, o passo vai a `revisao` e a EF15CO02 é marcada (`montagem`, com teto em \"em processo\": o \"atingiu\" só vem da simulação).",
    corpo: ChaveSchema,
    resposta: ChaveMontadaSchema,
    notas: [
      "`vagas`: exatamente 3, com blocos diferentes. (Os `.refine()` somem do OpenAPI; daí esta nota.)",
      "O reenvio da MESMA montagem devolve o estado; outra montagem depois de formada responde **409** `chave-ja-montada`.",
      "Antes de a revisão abrir para esta criança responde **409** `revisao-nao-liberada`.",
      PORTA,
    ],
  })
  chave(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const montagem = valida(ChaveSchema, corpo);
    return this.missao.montarChave(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), montagem);
  }

  @Get("revisao")
  @Contrato({
    resumo: "A mesa de revisão: o marcador que a Chave pôs em cada vaga da 1ª edição.",
    descricao:
      "`pilarEmFalta` de cada vaga — `fonte`, `data` ou `autoria` —, ou `null` quando a notícia daquela vaga está verificada. A essa altura a criança já viu o resultado e montou a Chave.",
    resposta: RevisaoSchema,
    notas: ["Antes de a Chave se formar responde **409** `chave-nao-formada`.", PORTA],
  })
  revisao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.revisao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("republicar")
  @HttpCode(200)
  @Contrato({
    resumo: '"Publicar 2ª Edição Revisada" — a 2ª edição (latch).',
    descricao:
      "O mesmo corpo da 1ª. Pode repetir as três vagas da 1ª edição: quem acertou de primeira confirma, sem trocar à força (PDF §9). Marca a EF04CO08 (`edicao-2`, com teto em \"em processo\") pelas pistas das duas fases e as verificadas da 2ª; o \"atingiu\" só vem da transferência.",
    corpo: PublicarSchema,
    resposta: EstadoSchema,
    notas: [
      "Segunda republicação — inclusive duas simultâneas — responde **409** `edicao-ja-publicada`; antes da Chave, **409** `chave-nao-formada`; com a rodada trocada no meio, **409** `rodada-mudou`.",
      PORTA,
    ],
  })
  republicar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const pub = valida(PublicarSchema, corpo);
    return this.missao.republicar(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), pub);
  }

  @Get("comparativo")
  @Contrato({
    resumo: "O antes e o depois: as duas edições, com o que cada uma causou.",
    descricao:
      "\"1ª Edição: 1 de 3 verificadas → 2ª Edição: 3 de 3\" (PDF §9). `vagas` diz o pilar que faltava em cada notícia das DUAS edições — a devolutiva final explica quais evidências sustentaram o resultado.",
    resposta: ComparativoSchema,
    notas: ["Antes da 2ª publicação responde **409** `edicao-nao-publicada`.", PORTA],
  })
  comparativo(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.comparativo(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("simulacao")
  @Contrato({
    resumo: "A simulação: as duas matérias novas e a Chave DELA como roteiro (3.0.0).",
    descricao:
      "As matérias vêm com as pistas e SEM o gabarito; a Chave, com o bloco de cada vaga, o \"se falhar\" e a repetição — e, na vaga com isca, a frase neutra de pulo (a matéria não traz o que a isca olharia).",
    resposta: SimulacaoDaTelaSchema,
    notas: ["Antes do passo `simulacao` responde **409** `passo-invalido`; sem Chave montada, **409** `chave-nao-formada`.", PORTA],
  })
  simulacao(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.simulacao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("simulacao")
  @HttpCode(200)
  @Contrato({
    resumo: "A Chave aplicada às duas matérias — enviada de uma vez (3.0.0).",
    descricao:
      "Por matéria, as pistas na ORDEM em que a criança as abriu, cada uma com o \"confio / não confio\" (obrigatório na simulação: a marcação é a execução) e a decisão. A api mede a FIDELIDADE à regra dela — a ordem das vagas, a parada no \"Não publico\", a decisão coerente — e marca a EF15CO02 (`simulacao`, o combinado com a montagem). O passo vai a `transferencia`, e a resposta traz a regra de referência, igual para todos.",
    corpo: SimularSchema,
    resposta: SimulacaoEnviadaSchema,
    notas: [
      "`materias`: `s1` e `s2`, uma vez cada; até 3 passos por matéria, sem repetir pista. (Os `.refine()` somem do OpenAPI.)",
      "Segundo envio responde **409** `simulacao-ja-enviada`; fora do passo, **409** `passo-invalido`.",
      PORTA,
    ],
  })
  simular(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const simulacao = valida(SimularSchema, corpo);
    return this.missao.simular(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), simulacao);
  }

  @Get("transferencia")
  @Contrato({
    resumo: "O boato da transferência e as três pistas dele (fixos).",
    descricao:
      "O de \"todas as escolas do bairro\", diferente do da mesa: aqui é transferência, e não memória. A tela é NEUTRA — nada nela pede para verificar.",
    resposta: TransferenciaDaTelaSchema,
    notas: ["Antes do passo `transferencia` responde **409** `passo-invalido`.", PORTA],
  })
  transferencia(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.transferencia(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Post("transferencia")
  @HttpCode(200)
  @Contrato({
    resumo: "A decisão diante do boato: repassar ou não — uma vez (3.0.0).",
    descricao:
      "As pistas abertas ANTES da decisão, na ordem, e a decisão. Marca a EF04CO08 (`transferencia`): o COMBINADO com a 2ª edição — \"atingiu\" só com a 2ª edição e a transferência no \"atingiu\". O passo continua `transferencia`; quem leva ao fim é o \"Concluir Missão\".",
    corpo: TransferirSchema,
    resposta: TransferenciaEnviadaSchema,
    notas: ["Segunda decisão responde **409** `transferencia-ja-decidida`; fora do passo, **409** `passo-invalido`.", PORTA],
  })
  transferir(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const t = valida(TransferirSchema, corpo);
    return this.missao.transferir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth), t);
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: '"Concluir Missão" — idempotente.',
    descricao:
      "Leva a sessão de `transferencia` a `fim` e carimba `concluidaEm`, no mesmo update — com o boato já decidido. A 3.0.0 não tem pergunta de múltipla escolha (ADR-168).",
    resposta: EstadoSchema,
    notas: [
      "Antes da transferência responde **409** `passo-invalido`; sem a decisão do boato, **409** `transferencia-pendente`. Concluir de novo devolve o mesmo estado.",
      PORTA,
    ],
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.missao.concluir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }
}
