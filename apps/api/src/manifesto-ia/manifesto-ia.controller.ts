import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { OidcGuard, type AuthClaims } from "../auth/oidc.guard";
import { Roles, RolesGuard } from "../auth/roles";
import { rateLimit } from "../comum/rate-limit";
import { Contrato } from "../openapi/contrato";
import {
  ClausulaRespostaSchema,
  ClausulaSchema,
  DisparoRespostaSchema,
  DisparoSchema,
  EstadoSchema,
  GatePublicoSchema,
  PercursoSchema,
  SessaoSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { ManifestoIaService } from "./manifesto-ia.service";
import { PASSOS } from "./regras/passos";

/**
 * Rotas do ESTUDANTE da exp-08-manifesto-ia.
 *
 * Duas regras do `AGENTS.md` atravessam este arquivo, e nenhuma é visível aqui
 * por acaso:
 *
 * - **Regra 3 (server-side).** Esta missão não tem resposta certa a corrigir —
 *   as quatro cláusulas valem —, mas tem coisas que só o servidor decide: a
 *   COTA de auditoria que abre o pico, o LATCH da escolha, a COMPILAÇÃO do
 *   manifesto e o FILTRO de dado pessoal. O cliente manda a escolha; a api
 *   decide o que acontece.
 * - **Regra 7 (ADR-69).** A guarda de liberação está no FUNIL do service
 *   (`estudanteDaEscola`), não aqui: rota nova nasce protegida sem ninguém
 *   lembrar de protegê-la.
 *
 * Identidade — inclusive a TURMA, que liga o estudante ao Checkpoint A — sai
 * sempre do token, nunca do body.
 */

type Autenticado = { auth: AuthClaims };

/** Por usuário, nunca por IP: a turma inteira sai pelo mesmo NAT da escola. */
function limitar(usuarioId: string, limite = 120) {
  const r = rateLimit(`manifesto:${usuarioId}`, limite, 60_000);
  if (!r.ok) {
    throw new HttpException({ mensagem: "Muitas ações em pouco tempo. Aguarde um instante." }, 429);
  }
}

/**
 * `z.output<S>`, e não `z.ZodType<T>`: três campos aqui têm `.default()`
 * (`latenciaSeg`, `confirmouProvocacao`), e com a assinatura genérica o
 * TypeScript infere o tipo de ENTRADA — em que eles são opcionais — em vez do
 * de saída, onde o default já foi aplicado. O sintoma é um `undefined` que só
 * aparece na chamada do service.
 */
function valida<S extends z.ZodTypeAny>(schema: S, corpo: unknown): z.output<S> {
  const parsed = schema.safeParse(corpo);
  if (!parsed.success) throw erroDeJogo("payload-invalido");
  return parsed.data;
}

function turmaDo(auth: AuthClaims): string | null {
  return auth.turmaId ?? null;
}

@Controller("manifesto-ia")
@UseGuards(OidcGuard, RolesGuard)
@Roles("estudante")
export class ManifestoIaController {
  constructor(private readonly manifesto: ManifestoIaService) {}

  @Get("sessao")
  @Contrato({
    resumo: "O estado da missão, o pacote da turma e a conversa reconstituída.",
    descricao:
      "Os 3 questionamentos saem **sem `replicaIa`** e as 4 cláusulas **sem `justificativaSugerida`** — os tipos do servidor são `Omit<...>`, então nem a defesa da máquina antes da pergunta nem o material de mediação do professor podem vazar aqui.\n\n`falas` é a conversa até agora, e é o que faz o F5 devolver a tela exata em vez de um chat vazio: a réplica de uma pergunta JÁ FEITA entra, porque a criança já a leu.\n\nO conteúdo vem do pacote HOMOLOGADO da turma; sem homologação, do banco curado da Unooria (`origemDoConteudo` diz qual).",
    resposta: SessaoSchema,
    notas: [
      "`passo` já vem reconciliado com a etapa da turma; `passoDoEstudante` é o cru. Divergentes com `aguardandoATurma: true` = o Checkpoint A está ativo e a tela mostra o overlay de pausa.",
      "`manifestoMarkdown` é `null` até a cláusula ser fixada. Devolver um esqueleto com o lugar da cláusula em branco entregaria a cena da Etapa 4.",
      "Rascunho de IA NÃO conta como pacote da turma: sem `aprovado_por_professor`, a missão lê o curado (exigência 8.2).",
    ],
  })
  sessao(@Req() req: Autenticado) {
    return this.manifesto.sessao(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }

  @Get("gate")
  @Contrato({
    resumo: "Em que etapa a turma está — o polling de 5s do Checkpoint A.",
    descricao:
      "Leve de propósito: sem catálogo e sem conversa. **É a alternativa ao WebSocket** (ADR-93): a infraestrutura Cloud Run da plataforma não tem WebSocket de aplicação, e o congelamento da turma para o debate oral é uma linha em `exp_08_gates_turma` que a tela do estudante lê a cada 5 segundos durante a Etapa 4.\n\n`agora` é o instante do SERVIDOR: o relógio da máquina da escola atrasa, e não é ele que decide o momento da aula.",
    query: z.object({ passo: z.enum(PASSOS).optional() }),
    resposta: GatePublicoSchema,
    notas: [
      "Estudante sem turma não tem gate: a missão corre no ritmo dele. Prendê-lo num congelamento seria um beco sem saída, porque não há quem o solte.",
      "O limite é mais alto que o das outras rotas justamente porque este é o polling — 240/min por usuário cobre 5s com folga para retry.",
    ],
  })
  gate(@Query("passo") passo: string | undefined, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId, 240);
    return this.manifesto.gate(req.auth.escolaId, turmaDo(req.auth), passo);
  }

  @Post("abrir-conversa")
  @HttpCode(200)
  @Contrato({
    resumo: "Sai do briefing de Amara e abre o chat do EduPredict IA.",
    descricao:
      "Idempotente. Existe como rota para o `passo` andar no SERVIDOR: um F5 na Etapa 2 não pode devolver a criança ao alerta de Amara que ela já ouviu.",
    resposta: EstadoSchema,
  })
  abrirConversa(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.manifesto.abrirConversa(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
    );
  }

  @Post("disparar")
  @HttpCode(200)
  @Contrato({
    resumo: "Envia um questionamento e recebe a defesa da máquina.",
    descricao:
      "**A `replica` só existe nesta resposta.** Ela não está no bundle nem em `GET /sessao` antes do disparo: ver a defesa antes de fazer a pergunta desmontaria a cena da auditoria.\n\nQuando o SEGUNDO questionamento distinto entra, o `passo` anda para `decisao` aqui, no servidor. Deixar o cliente pedir a transição seria deixá-lo escolher quando o pico da missão começa — e uma tela que decide isso é uma tela que pode pular o pico.",
    corpo: DisparoSchema,
    resposta: DisparoRespostaSchema,
    notas: [
      "Reenviar o mesmo id responde 409 `prompt-ja-enviado`: o card já disparado fica desabilitado no seletor, então um segundo disparo só chega por clique duplo ou aba repetida — e a conversa não pode ganhar a mesma pergunta duas vezes.",
      "`latenciaSeg` é calibragem de fluxo, NUNCA medida de mérito: ninguém é avaliado por ler rápido.",
      "O terceiro questionamento é opcional e permitido: dois é o mínimo que abre a Etapa 3, não um teto.",
    ],
  })
  disparar(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { promptId, latenciaSeg } = valida(DisparoSchema, corpo);
    return this.manifesto.disparar(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      promptId,
      latenciaSeg,
    );
  }

  @Post("clausula")
  @HttpCode(200)
  @Contrato({
    resumo: "Fixa a salvaguarda prioritária — irrevogável (latch).",
    descricao:
      "O PICO da missão. A api confere a cota de auditoria ANTES de aceitar (409 `auditoria-insuficiente`) e **compila o manifesto no servidor**, porque o documento é a evidência do percurso: o que a professora lê no painel e o que o estudante copiou têm de ser o mesmo texto.\n\nSegunda chamada responde 409 `clausula-ja-submetida`: a escolha é definitiva, e é isso que faz o estudante assumir o peso dela.\n\n**Nada é corrigido aqui.** As quatro cláusulas são salvaguardas válidas, e calcular acerto entre elas está na lista de métricas proibidas do handoff.",
    corpo: ClausulaSchema,
    resposta: ClausulaRespostaSchema,
    notas: [
      "`delayMs` é o delay diegético de 2000ms (não-negociável 2). O timer roda no CLIENTE porque é ritmo de cena, e o número vem do servidor para a documentação e a tela lerem o mesmo valor.",
      "`confirmouProvocacao` registra que a criança clicou em menos de 5s e passou pela réplica provocativa do bot. É `indicative` e alimenta a hipótese de exploração mínima — nunca avalia ninguém.",
      "A guarda da cota vale no servidor mesmo com o botão desabilitado na tela: `/manifesto-ia/clausula` é endereço alcançável.",
    ],
  })
  clausula(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { clausulaId, latenciaSeg, confirmouProvocacao } = valida(ClausulaSchema, corpo);
    return this.manifesto.submeterClausula(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      clausulaId,
      latenciaSeg,
      confirmouProvocacao,
    );
  }

  @Post("percurso")
  @HttpCode(200)
  @Contrato({
    resumo: 'O "Meu Percurso" — 2 palavras-chave e o parágrafo autoral (latch).',
    descricao:
      "Texto livre de 20 a 800 caracteres. É o **único** campo livre da missão e o dado mais sensível dela: caixa escrita por menor de idade. Não vai a log, não vai à telemetria analítica, e a única rota que o devolve é o painel do professor DA TURMA dela (LGPD art. 14).\n\n**Dado pessoal é RECUSADO com 422 `dado-pessoal-no-texto` e NÃO gravado.** As alternativas (gravar com flag, ou ofuscar e salvar) foram descartadas: a primeira deixaria o telefone da criança na coluna à espera de alguém, a segunda devolveria à professora um parágrafo mutilado. Recusar também ensina — a dica diz o que tirar, no momento em que ela ia entregar o dado.\n\nDurante o Checkpoint A responde 409 `debate-em-andamento`: a assinatura individual abre depois da discussão coletiva.",
    corpo: PercursoSchema,
    resposta: EstadoSchema,
    notas: [
      "O `trim` é anterior ao `min`: vinte espaços passariam o piso de 20 caracteres e contariam como entregue no painel.",
      "As duas palavras-chave têm de ser DIFERENTES: repetir deixa um slot logicamente vazio dentro de um array cheio.",
      "O filtro NÃO tenta adivinhar nome próprio, de propósito: recusar 'meu tio Silva foi reprovado' cortaria justamente o argumento situado que esta etapa mede. O que ele pega é padrão estruturado — telefone, CPF, e-mail, CEP, cartão, @perfil.",
    ],
  })
  percurso(@Body() corpo: unknown, @Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    const { tags, justificativa } = valida(PercursoSchema, corpo);
    return this.manifesto.registrarPercurso(
      req.auth.escolaId,
      req.auth.usuarioId,
      turmaDo(req.auth),
      [...tags],
      justificativa,
    );
  }

  @Post("concluir")
  @HttpCode(200)
  @Contrato({
    resumo: "Finaliza o percurso e concede o selo — latch definitivo.",
    descricao:
      "**Não recebe `score`**, e a ausência é a regra 3 aplicada a uma missão sem nota: o `exp:concluir` da bridge tem o campo, e aceitar um número dali deixaria a tela pontuar uma atividade cuja premissa é que as quatro escolhas valem igual. O progresso da plataforma lê `concluido_em`.\n\nExige o percurso registrado (409 `sem-clausula`). Segunda chamada responde 409 `missao-concluida`.",
    resposta: EstadoSchema,
  })
  concluir(@Req() req: Autenticado) {
    limitar(req.auth.usuarioId);
    return this.manifesto.concluir(req.auth.escolaId, req.auth.usuarioId, turmaDo(req.auth));
  }
}
