import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { AI_PROVIDER, ErroDeGeracao, type AiProvider } from "../ai/provider";
import { QuotaService } from "../ai/quota.service";
import type { Perfil } from "../auth/claims";
import { PrismaService } from "../prisma/prisma.service";
import { exigirMissaoLiberada } from "../comum/liberacao";
import {
  ondeAsTurmasSaoVisiveis,
  professorEnsinaOEstudante,
  professorLeciona,
} from "../comum/turmas-do-professor";
import { mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades } from "../equipes/regras";
import { MISSAO_TEMPESTADE } from "./cenario";

/** Quanto cada toque em "+2 min" acrescenta ao relógio da aula. */
export const INCREMENTO_SEG = 120;
import { erroDeJogo } from "./erros";
import { VERSAO_PROMPT, responder } from "./agente/prompt";
import { classificarTurno } from "./agente/turno";
import { CONJUNTOS, CONJUNTO_POR_SLUG } from "./modelo/conjuntos";
import { type Alocacao, esperadoDe, simular } from "./modelo/tempestade";
import { sementeDe } from "./modelo/aleatorio";
import { passoDerivado, type PassoDerivavel } from "./regras/anexos";
import { montarMapa, naoCarregados, oQueSobrou } from "./regras/camadas";
import { projetar } from "./regras/projecao";
import { EXP_ID, TETO_CHAMADAS_SESSAO, TETO_TOKENS_SESSAO } from "./regras/defaults";
import {
  INTUICAO,
  comoOProfessorLe,
  faltaJustificar,
  justificativaValida,
  opcoesDeJustificativa,
} from "./regras/justificativa";
import {
  VERSAO_LEITURA,
  contarPorGrau,
  linhasDeLeitura,
  resumoHonesto,
  type SinaisDaPartida,
} from "./leitura";
import { TETO_DE_PERGUNTAS, gastaPergunta, perguntasRestantes } from "./regras/orcamento";
import { type Passo, podeIr } from "./regras/passos";
import {
  RELOGIO,
  RELOGIO_PADRAO,
  type EstadoDoRelogio,
  type RelogioDaTurma,
  estadoDoRelogio,
  horaDoCartao,
  pivoParaEstender,
  podePerguntar,
  saidaDasEquipes,
} from "./regras/relogio";
import { sanitizarFicha, sanitizarRelogio, sanitizarSessao } from "./regras/sanitizador";
import {
  type Marco,
  marcoDeAlocacao,
  marcoDeEnvio,
  marcoDeFontes,
  marcoDeInicio,
  marcoDeLeitura,
  marcoDeRecomeco,
  mudancasDeDestino,
} from "./regras/trilha";
import { coberturaDoRisco, percentilEntre, posicaoNaFaixa } from "./regras/desfecho";

/**
 * O serviço da exp02em1b — a Missão Tempestade.
 *
 * Porte de `lib/missao/servico.ts` do projeto `gpturia`, com quatro diferenças
 * que vêm da plataforma e não do jogo:
 *
 * 1. TENANCY. Toda query passa por `comTenancy(fn, escolaId)` E filtra
 *    `escolaId` no `where` — defesa em profundidade: a RLS é rede, não a única
 *    tranca (regra inviolável nº 1).
 * 2. IDENTIDADE. A sessão é `(escolaId, estudanteId)` vindos do TOKEN. Lá era um
 *    uuid na URL, e existia a guarda `donoDaSessao` para provar a posse; aqui
 *    não há o que provar, porque não há como pedir a sessão de outro.
 * 3. IA. O provider é injetado (`AI_PROVIDER`) e a quota é consultada ANTES e
 *    consumida DEPOIS, sempre — mesmo quando o turno falha, porque o token foi
 *    gasto de todo modo.
 * 4. TETO POR SESSÃO. Novo: a quota diária da plataforma é fusível, mas não sabe
 *    que UMA partida daqui custa duas ordens de grandeza mais que um turno de
 *    tutor. O teto que importa é por sessão (`regras/defaults.ts`).
 *
 * O que NÃO mudou, e é o coração: a chamada ao modelo acontece FORA da
 * transação (segurar conexão durante 10–30s de LLM esgota o pool com uma turma
 * inteira simultânea), e o relógio é RECONFERIDO depois dela, porque a resposta
 * pode ter atravessado o fechamento da investigação.
 */
@Injectable()
export class UnoogptService {
  private readonly log = new Logger(UnoogptService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider,
    private readonly quota: QuotaService,
  ) {}

  // =========================================================================
  // Leitura
  // =========================================================================

  /**
   * O bootstrap da experiência: tudo o que a tela precisa para abrir, num
   * request. Cria a sessão na primeira visita.
   */
  async sessao(escolaId: string, estudanteId: string) {
    const agora = new Date();
    return this.prisma.comTenancy(async (tx) => {
      const sessao = await this.garantirSessao(tx, escolaId, estudanteId);
      const relogio = await this.relogioDaTurma(tx, escolaId, sessao.turmaId);
      const estado = estadoDoRelogio(relogio, agora);

      const falas = await tx.unoogptMensagem.findMany({
        where: { escolaId, estudanteId: estudanteId, tentativa: sessao.tentativa },
        orderBy: { id: "asc" },
        select: { papel: true, texto: true, anexo: true, criadoEm: true },
      });

      const { bairros } = montarMapa(this.semente(escolaId, estudanteId), sessao.rodadas, sessao.conjuntos, estado.minutosGastos);

      return {
        ficha: sanitizarFicha(MISSAO_TEMPESTADE),
        // A PROJEÇÃO é servida, nunca calculada no navegador: ela usa
        // `chegaATempo` e a capacidade da equipe, e um bundle capaz de computar
        // isso deixaria o estudante prever o desfecho antes de enviar.
        projecao: projetar(
          bairros,
          { alfa: sessao.alocacaoAlfa, bravo: sessao.alocacaoBravo },
          estado.minutosGastos,
          sessao.conjuntos.includes("viaria"),
        ),
        sessao: sanitizarSessao(sessao),
        relogio: sanitizarRelogio(relogio, agora),
        estado: {
          fase: estado.fase,
          aberta: estado.aberta,
          segundosAteFechar: estado.segundosAteFechar,
          minutosGastos: estado.minutosGastos,
          motivoDoFim: estado.motivoDoFim,
        },
        mapa: bairros,
        conversa: falas.map((f) => ({
          papel: f.papel as "estudante" | "agente",
          texto: f.texto,
          anexo: f.anexo ?? null,
        })),
        orcamento: { gastas: sessao.perguntasGastas, teto: TETO_DE_PERGUNTAS },
        justificativas: opcoesDeJustificativa(sessao.conjuntos),
      };
    }, escolaId);
  }

  /** Polling do relógio da turma (~5s). Leve de propósito: sem IA, sem mapa. */
  async relogio(escolaId: string, estudanteId: string) {
    const agora = new Date();
    return this.prisma.comTenancy(async (tx) => {
      const sessao = await this.garantirSessao(tx, escolaId, estudanteId);
      const relogio = await this.relogioDaTurma(tx, escolaId, sessao.turmaId);
      const estado = estadoDoRelogio(relogio, agora);
      return {
        relogio: sanitizarRelogio(relogio, agora),
        estado: {
          fase: estado.fase,
          aberta: estado.aberta,
          segundosAteFechar: estado.segundosAteFechar,
          minutosGastos: estado.minutosGastos,
          motivoDoFim: estado.motivoDoFim,
        },
      };
    }, escolaId);
  }

  // =========================================================================
  // O turno do Cientista — a rota central
  // =========================================================================

  async pergunta(escolaId: string, estudanteId: string, perfil: Perfil, texto: string) {
    const agora = new Date();

    // --- 1. lê o estado e os portões, SEM segurar transação ---
    const antes = await this.prisma.comTenancy(async (tx) => {
      const sessao = await this.garantirSessao(tx, escolaId, estudanteId);
      const relogio = await this.relogioDaTurma(tx, escolaId, sessao.turmaId);
      const ultima = await tx.unoogptMensagem.findFirst({
        where: { escolaId, estudanteId: estudanteId, tentativa: sessao.tentativa, papel: "agente" },
        orderBy: { id: "desc" },
        select: { texto: true },
      });
      const quantas = await tx.unoogptMensagem.count({
        where: { escolaId, estudanteId: estudanteId, tentativa: sessao.tentativa },
      });
      return { sessao, relogio, ultimaFalaDoAgente: ultima?.texto ?? null, primeiraFala: quantas === 0 };
    }, escolaId);

    const estado = estadoDoRelogio(antes.relogio, agora);
    // Antes da largada o estudante vê o cronômetro parado e não fala com o
    // Cientista: a sala começa junto (o relógio é da TURMA).
    if (estado.fase === "aguardando") throw erroDeJogo("relogio-nao-comecou");
    if (!podePerguntar(estado)) throw erroDeJogo("relogio-encerrado");
    if (antes.sessao.concluidoEm) throw erroDeJogo("sessao-encerrada");

    // Teto por sessão ANTES de gastar: recusar depois seria pagar pelo que não
    // se entrega.
    if (
      antes.sessao.chamadasIa >= TETO_CHAMADAS_SESSAO ||
      antes.sessao.tokensGastos >= TETO_TOKENS_SESSAO
    ) {
      throw erroDeJogo("teto-da-sessao");
    }
    if (!(await this.quota.temSaldo(escolaId, estudanteId, perfil))) throw erroDeJogo("teto-da-sessao");

    // O SERVIÇO classifica o turno porque é ele que DEBITA: o orçamento é
    // procedural, e deixar a LLM decidir se gastou seria entregar a contagem a
    // quem ela restringe.
    const tipo = classificarTurno(texto, {
      temDestino: antes.sessao.alocacaoAlfa !== null || antes.sessao.alocacaoBravo !== null,
      primeiraFala: antes.primeiraFala,
      ultimaFalaDoAgente: antes.ultimaFalaDoAgente,
    });
    const restantes = perguntasRestantes(antes.sessao.perguntasGastas);
    // Perguntar sobre a cidade acabou; conversar e decidir, não.
    if (tipo === "pergunta" && restantes === 0) throw erroDeJogo("sem-perguntas");

    // --- 2. chama o modelo FORA de transação ---
    const historico = await this.historico(escolaId, estudanteId, antes.sessao.tentativa);
    const semente = this.semente(escolaId, estudanteId);
    let tokens = 0;

    try {
      const resposta = await responder(
        this.provider,
        semente,
        antes.sessao.rodadas,
        antes.sessao.conjuntos,
        { segundosAteFechar: estado.segundosAteFechar, minutosGastos: estado.minutosGastos },
        historico,
        texto,
        // As ferramentas escrevem no banco em transações próprias, curtas: o
        // estudante pode carregar uma fonte e alocar no MESMO turno, e cada ato
        // precisa estar durável antes de o modelo narrar o seguinte.
        (dados) => this.aoUsarDados(escolaId, estudanteId, dados),
        (destinos) => this.aoAlocar(escolaId, estudanteId, destinos),
        () => this.aoConfirmar(escolaId, estudanteId, perfil),
        { temDestino: antes.sessao.alocacaoAlfa !== null || antes.sessao.alocacaoBravo !== null, tipo, perguntasRestantes: restantes },
      );
      tokens = resposta.tokensUsados;

      // --- 3. grava a Transcrição e o débito, EM transação ---
      return await this.prisma.comTenancy(async (tx) => {
        await this.lock(tx, escolaId, estudanteId);
        const atual = await tx.unoogptSessao.findUniqueOrThrow({
          where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        });
        // Reconferido com o relógio de AGORA: a resposta do provedor pode ter
        // demorado e atravessado o fechamento da investigação.
        const relogioAgora = await this.relogioDaTurma(tx, escolaId, atual.turmaId);
        const depois = estadoDoRelogio(relogioAgora, new Date());

        // O cartão de leitura precisa dizer de QUANDO ele é: sem a hora, três
        // relatórios seguidos parecem o mesmo, e o estudante não percebe que cada
        // um custou tempo.
        const tipoDoAnexo = (resposta.anexo as { tipo?: string } | null)?.tipo;
        const anexo =
          tipoDoAnexo === "tendencia" || tipoDoAnexo === "opcoes"
            ? { ...(resposta.anexo as object), hora: horaDoCartao(depois) }
            : resposta.anexo;

        // Consultou alguma coisa para responder? É isto que separa uma pergunta
        // respondida de uma que ele não teve como responder — e a segunda não
        // pode custar, senão o estudante aprende a não perguntar. Calculado ANTES de
        // gravar: `debitou` na fala do estudante é a trilha de auditoria de qual
        // turno custou pergunta, e é por ela que se reconstrói o orçamento.
        // `dadosUsados` VAZIO não é consulta. O Cientista pode ter chamado
        // `usar_dados` e não ter carregado nada (argumento que não casa com
        // fonte nenhuma) — e cobrar por isso ensinaria o estudante a não perguntar,
        // que é o contrário do ponto. Só conta como consulta se o modelo rodou
        // ou se há fonte de fato em uso.
        const consultou =
          resposta.rodada !== null || (resposta.dadosUsados?.length ?? 0) > 0;
        const debita = gastaPergunta(tipo, consultou);

        const comum = { escolaId, estudanteId: estudanteId, passo: atual.passo, tentativa: atual.tentativa };
        // `criadoEm: agora` — a hora em que o estudante APERTOU enviar, não a
        // em que o Cientista terminou de responder (10–30 s depois). Sem isto o
        // relatório do professor datava a fala pelo fim do turno.
        await tx.unoogptMensagem.create({
          data: { ...comum, papel: "estudante", texto, debitou: debita, criadoEm: agora },
        });

        await tx.unoogptMensagem.create({
          data: {
            ...comum,
            papel: "agente",
            texto: resposta.texto,
            debitou: false,
            // Prisma trata null em Json de forma especial: omitir deixa a
            // coluna nula, que é o que "fala sem cartão" quer dizer.
            ...(anexo ? { anexo: anexo as Prisma.InputJsonValue } : {}),
          },
        });
        if (resposta.rodada) {
          await this.gravarMarco(
            tx,
            escolaId,
            estudanteId,
            atual.tentativa,
            marcoDeLeitura(depois.minutosGastos, resposta.rodada),
            depois,
          );
        }

        const atualizada = await tx.unoogptSessao.update({
          where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
          data: {
            minutosGastos: depois.minutosGastos,
            // Débito em TRANSAÇÃO, sob o lock acima: duas abas não gastam a
            // mesma pergunta duas vezes.
            ...(debita ? { perguntasGastas: { increment: 1 } } : {}),
            tokensGastos: { increment: tokens },
            chamadasIa: { increment: 1 },
            passo: passoDerivado(
              { confirmou: resposta.confirmou !== null },
              atual.passo as PassoDerivavel,
            ),
          },
        });

        return {
          texto: resposta.texto,
          anexo: anexo ?? null,
          sessao: sanitizarSessao(atualizada),
          relogio: sanitizarRelogio(relogioAgora, new Date()),
          mapa: montarMapa(semente, atualizada.rodadas, atualizada.conjuntos, depois.minutosGastos).bairros,
          orcamento: { gastas: atualizada.perguntasGastas, teto: TETO_DE_PERGUNTAS },
          justificativas: opcoesDeJustificativa(atualizada.conjuntos),
        };
      }, escolaId);
    } catch (erro) {
      /**
       * Falha do PROVEDOR não pode chegar ao estudante como 500.
       *
       * Sem isto, credencial ausente, cota do vendor ou rede instável viravam
       * "Internal Server Error" dentro do iframe — e o estudante de 16 anos não tem
       * o que fazer com isso. Vira `cientista-indisponivel` (503), que a tela
       * traduz em "O Cientista não conseguiu responder agora. Tente falar de
       * novo." E NÃO debita: o débito acontece só depois de resposta válida.
       *
       * O log fica com o motivo técnico — sem o texto do estudante, que é caixa
       * livre escrita por menor de idade.
       */
      if (erro instanceof ErroDeGeracao) {
        this.log.error(`turno sem resposta: ${erro.message}`, erro.detalhe);
        throw erroDeJogo("cientista-indisponivel");
      }
      throw erro;
    } finally {
      // No `finally`: o token foi gasto mesmo quando o turno falhou, e a quota
      // que não conta a falha é quota que não protege nada.
      if (tokens > 0) await this.quota.consumir(escolaId, estudanteId, tokens);
    }
  }

  // =========================================================================
  // Ferramentas do Cientista (chamadas de dentro do turno)
  // =========================================================================

  /** ADICIONA conjuntos ao que já está carregado. Investigação é em camadas. */
  private async aoUsarDados(escolaId: string, estudanteId: string, pedidos: string[]): Promise<string[]> {
    const validos = pedidos.filter((p) => CONJUNTO_POR_SLUG.has(p));
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      const somadas = validos.filter((v) => !atual.conjuntos.includes(v));
      if (somadas.length === 0) return atual.conjuntos;

      // O relógio de AGORA, não `atual.minutosGastos`: aquele é o instante do
      // último turno, e um turno leva de 10 a 30 s (2 a 6 minutos da cidade).
      const estado = await this.relogioAgora(tx, escolaId, atual.turmaId);
      const conjuntos = [...atual.conjuntos, ...somadas];
      const atualizada = await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        data: { conjuntos, rodadas: { increment: 1 }, minutosGastos: estado.minutosGastos },
      });
      await this.gravarMarco(
        tx,
        escolaId,
        estudanteId,
        atual.tentativa,
        marcoDeFontes(estado.minutosGastos, somadas),
        estado,
      );
      return atualizada.conjuntos;
    }, escolaId);
  }

  private async aoAlocar(
    escolaId: string,
    estudanteId: string,
    destinos: { alfa?: string; bravo?: string },
  ): Promise<Alocacao | null> {
    const conhecido = (b?: string) => MISSAO_TEMPESTADE.bairros.some((x) => x.slug === b);
    if (destinos.alfa && !conhecido(destinos.alfa)) return null;
    if (destinos.bravo && !conhecido(destinos.bravo)) return null;

    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      const alocacao: Alocacao = {
        alfa: destinos.alfa ?? atual.alocacaoAlfa,
        bravo: destinos.bravo ?? atual.alocacaoBravo,
      };
      const estado = await this.relogioAgora(tx, escolaId, atual.turmaId);
      await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        data: { alocacaoAlfa: alocacao.alfa, alocacaoBravo: alocacao.bravo, minutosGastos: estado.minutosGastos },
      });
      await this.gravarMarco(
        tx,
        escolaId,
        estudanteId,
        atual.tentativa,
        marcoDeAlocacao(estado.minutosGastos, alocacao),
        estado,
      );
      return alocacao;
    }, escolaId);
  }

  /** Enfrentar a tempestade. Ponto sem volta, e idempotente por tentativa. */
  private async aoConfirmar(escolaId: string, estudanteId: string, _perfil: Perfil) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      if (!atual.alocacaoAlfa || !atual.alocacaoBravo) return null;

      const ja = await tx.unoogptSimulacao.findUnique({
        where: { escolaId_estudanteId_ordem: { escolaId, estudanteId: estudanteId, ordem: atual.tentativa } },
      });
      if (ja) return ja.desfecho;

      // A hora da SAÍDA é a hora de agora no relógio da turma. Antes era
      // `atual.minutosGastos`, que só o turno do Cientista atualizava: quem
      // alocava pelo mapa e enviava sem falar de novo saía no minuto de um turno
      // atrás — e chegava a bairros que já não alcançaria (ADR-64).
      const estado = await this.relogioAgora(tx, escolaId, atual.turmaId);
      const saida = saidaDasEquipes(estado.minutosGastos);
      const alocacao: Alocacao = { alfa: atual.alocacaoAlfa, bravo: atual.alocacaoBravo };
      const desfecho = simular(alocacao, sementeDe(`${escolaId}:${estudanteId}:${atual.tentativa}`), {
        saidaEmMinutos: saida,
      });
      // A FAIXA da mesma decisão, gravada JUNTO do desfecho: recomputá-la a cada
      // leitura fazia uma mudança de parâmetro reescrever, em silêncio, o
      // relatório de partidas antigas.
      const faixa = esperadoDe(alocacao, { saidaEmMinutos: saida }, 200);
      const esperado = {
        v: 1,
        media: faixa.media,
        faixa: faixa.faixa,
        vitimasMedia: faixa.vitimasMedia,
        vitimasFaixa: faixa.vitimasFaixa,
        amostras: faixa.amostras,
        percentil: percentilEntre(desfecho.totais.salvas, faixa.todas),
      };

      await tx.unoogptSimulacao.create({
        data: {
          escolaId,
          estudanteId: estudanteId,
          ordem: atual.tentativa,
          alocacao: { v: 1, ...alocacao } as Prisma.InputJsonValue,
          desfecho: desfecho as unknown as Prisma.InputJsonValue,
          esperado: esperado as unknown as Prisma.InputJsonValue,
          minutoDaSaida: saida,
          versaoPrompt: VERSAO_PROMPT,
        },
      });
      await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        data: { passo: "resultado", minutosGastos: saida, concluidoEm: new Date() },
      });
      await this.gravarMarco(
        tx,
        escolaId,
        estudanteId,
        atual.tentativa,
        marcoDeEnvio(saida, desfecho.totais, naoCarregados(atual.conjuntos).map((c) => c.slug), {
          alfa: comoOProfessorLe(atual.justificativaAlfa),
          bravo: comoOProfessorLe(atual.justificativaBravo),
        }),
        estado,
      );
      return desfecho;
    }, escolaId);
  }

  // =========================================================================
  // Rotas de mutação direta (mapa, painel, botões)
  // =========================================================================

  /** Carregar fontes pelo painel, sem passar pelo Cientista. */
  async carregarConjuntos(escolaId: string, estudanteId: string, conjuntos: string[]) {
    const emUso = await this.aoUsarDados(escolaId, estudanteId, conjuntos);
    return this.estadoPublico(escolaId, estudanteId, emUso);
  }

  /**
   * Alocar pelo mapa ou pelo painel, COM a justificativa.
   *
   * A justificativa é portão de SERVIDOR: só vale fonte que o estudante carregou,
   * ou "foi intuição" — que está sempre disponível, porque sem essa saída a
   * pergunta vira pegadinha e o estudante aprende a mentir para o formulário.
   */
  async alocar(
    escolaId: string,
    estudanteId: string,
    equipe: "alfa" | "bravo",
    bairro: string | null,
    justificativa: string | null,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      if (atual.concluidoEm) throw erroDeJogo("sessao-encerrada");
      if (bairro !== null && !MISSAO_TEMPESTADE.bairros.some((b) => b.slug === bairro)) {
        throw erroDeJogo("bairro-desconhecido");
      }
      if (bairro !== null && justificativa !== null && !justificativaValida(justificativa, atual.conjuntos)) {
        throw erroDeJogo("falta-justificar");
      }

      const alvo = equipe === "alfa" ? "alocacaoAlfa" : "alocacaoBravo";
      const porque = equipe === "alfa" ? "justificativaAlfa" : "justificativaBravo";
      const estado = await this.relogioAgora(tx, escolaId, atual.turmaId);
      const atualizada = await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        data: {
          [alvo]: bairro,
          // Tirar a equipe do bairro apaga o porquê junto: justificativa sem
          // destino é estado impossível (há CHECK no banco).
          [porque]: bairro === null ? null : justificativa,
          minutosGastos: estado.minutosGastos,
        },
      });
      await this.gravarMarco(
        tx,
        escolaId,
        estudanteId,
        atual.tentativa,
        marcoDeAlocacao(estado.minutosGastos, { alfa: atualizada.alocacaoAlfa, bravo: atualizada.alocacaoBravo }),
        estado,
      );
      const { bairros } = montarMapa(
        this.semente(escolaId, estudanteId),
        atualizada.rodadas,
        atualizada.conjuntos,
        estado.minutosGastos,
      );
      return {
        sessao: sanitizarSessao(atualizada),
        // "chega com N de sobra" vem do servidor: sem isto o Cientista registra
        // um destino inalcançável sem uma palavra, e o estudante só descobre no
        // desfecho — quando não dá mais para escolher diferente.
        projecao: projetar(
          bairros,
          { alfa: atualizada.alocacaoAlfa, bravo: atualizada.alocacaoBravo },
          estado.minutosGastos,
          atualizada.conjuntos.includes("viaria"),
        ),
      };
    }, escolaId);
  }

  /** O botão "enfrentar a tempestade". Exige as duas justificativas. */
  async simular(escolaId: string, estudanteId: string) {
    const pendentes = await this.prisma.comTenancy(async (tx) => {
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      return faltaJustificar(
        { alfa: atual.alocacaoAlfa, bravo: atual.alocacaoBravo },
        { alfa: atual.justificativaAlfa, bravo: atual.justificativaBravo },
        atual.conjuntos,
      );
    }, escolaId);
    if (pendentes.length > 0) throw erroDeJogo("falta-justificar");

    const desfecho = await this.aoConfirmar(escolaId, estudanteId, "estudante");
    if (!desfecho) throw erroDeJogo("falta-justificar");
    return this.resultado(escolaId, estudanteId);
  }

  /**
   * "E se eu tivesse mandado para…" — calculado e DESCARTADO.
   *
   * Não grava e não debita: é a pergunta que o estudante faz ao ver o resultado, e
   * transformá-la em tentativa nova apagaria a diferença entre a decisão que
   * ele tomou e a que ele imaginou depois.
   */
  async contrafactual(escolaId: string, estudanteId: string, alocacao: Alocacao) {
    return this.prisma.comTenancy(async (tx) => {
      const real = await tx.unoogptSimulacao.findUnique({
        where: { escolaId_estudanteId_ordem: { escolaId, estudanteId: estudanteId, ordem: (await tx.unoogptSessao.findUniqueOrThrow({ where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } } })).tentativa } },
      });
      if (!real) throw erroDeJogo("sessao-encerrada");
      const faixa = esperadoDe(alocacao, { saidaEmMinutos: real.minutoDaSaida }, 200);
      return { alocacao, media: faixa.media, faixa: faixa.faixa };
    }, escolaId);
  }

  async irParaPasso(escolaId: string, estudanteId: string, para: Passo) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      // ENVELOPE `{ sessao }` — o mesmo de `alocar` e `carregarConjuntos`.
      // Devolver a sessão crua daqui fazia o cliente ler `dados.sessao` como
      // `undefined` e derrubar a árvore inteira do React: a tela ficava BRANCA
      // dentro do iframe, sem erro de console. Nenhum typecheck vê através do
      // HTTP; quem pegou foi o smoke visual.
      if (atual.passo === para) return { sessao: sanitizarSessao(atual) };
      if (!podeIr(atual.passo as Passo, para)) throw erroDeJogo("passo-invalido");
      const atualizada = await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        data: { passo: para },
      });
      // Entrar na Investigação é o "abriu a missão" do relatório: é de onde se
      // mede quanto demorou até a primeira fala. Uma vez por tentativa — voltar
      // à Orientação e retornar não é começar de novo.
      if (para === "investigacao") {
        const jaComecou = await tx.unoogptMarco.count({
          where: { escolaId, estudanteId: estudanteId, tentativa: atual.tentativa, tipo: "inicio" },
        });
        if (jaComecou === 0) {
          const estado = await this.relogioAgora(tx, escolaId, atual.turmaId);
          await this.gravarMarco(
            tx,
            escolaId,
            estudanteId,
            atual.tentativa,
            marcoDeInicio(estado.minutosGastos),
            estado,
          );
        }
      }
      return { sessao: sanitizarSessao(atualizada) };
    }, escolaId);
  }

  /**
   * Recomeçar ABRE uma tentativa nova em vez de apagar a conversa: para o estudante
   * a tela limpa, para o professor a aula inteira continua legível. Comparar
   * duas tentativas é o que ensina.
   */
  async reiniciar(
    escolaId: string,
    estudanteId: string,
    origem: "investigacao" | "resultado" | null = null,
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.lock(tx, escolaId, estudanteId);
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      // O clique fica registrado na tentativa que FECHA, com o relógio que o
      // estudante via: qual botão (`origem` vem do cliente, é a única coisa que
      // só ele sabe), e se a aula estava correndo, encerrada ou nem começada.
      const relogio = await this.relogioDaTurma(tx, escolaId, atual.turmaId);
      const estado = estadoDoRelogio(relogio, new Date());
      await this.gravarMarco(
        tx,
        escolaId,
        estudanteId,
        atual.tentativa,
        marcoDeRecomeco(estado.minutosGastos, { origem, fase: estado.fase, modo: relogio.modo }),
        estado,
      );
      const atualizada = await tx.unoogptSessao.update({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
        data: {
          tentativa: atual.tentativa + 1,
          passo: "abertura",
          conjuntos: [],
          rodadas: 0,
          perguntasGastas: 0,
          minutosGastos: 0,
          alocacaoAlfa: null,
          alocacaoBravo: null,
          justificativaAlfa: null,
          justificativaBravo: null,
          concluidoEm: null,
        },
      });
      return { sessao: sanitizarSessao(atualizada) };
    }, escolaId);
  }

  /** O Resultado: a faixa é a manchete, e o que sobrou é o fato. */
  async resultado(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      const sim = await tx.unoogptSimulacao.findUnique({
        where: { escolaId_estudanteId_ordem: { escolaId, estudanteId: estudanteId, ordem: atual.tentativa } },
      });
      if (!sim) throw erroDeJogo("sessao-encerrada");

      const desfecho = sim.desfecho as unknown as ReturnType<typeof simular>;
      const alocacao: Alocacao = { alfa: atual.alocacaoAlfa, bravo: atual.alocacaoBravo };
      const faixa = esperadoDe(alocacao, { saidaEmMinutos: sim.minutoDaSaida }, 200);

      // `tentativa` e `ordem` vão junto: a tela do resultado agrupa a trilha por
      // tentativa para o estudante comparar duas rodadas lado a lado.
      // Só os quatro tipos que a linha do tempo do estudante sabe descrever:
      // `inicio` e `recomeco` são do relatório do professor, e o cliente cairia
      // no ramo de "envio" ao tentar narrá-los.
      const marcos = await tx.unoogptMarco.findMany({
        where: { escolaId, estudanteId: estudanteId, tipo: { in: ["fontes", "leitura", "alocacao", "envio"] } },
        orderBy: [{ tentativa: "asc" }, { ordem: "asc" }],
        select: { tentativa: true, ordem: true, tipo: true, minuto: true, dados: true },
      });

      // Todas as tentativas, para o estudante COMPARAR. Recomeçar abre tentativa
      // nova em vez de apagar a anterior justamente por isto: ver que a mesma
      // cidade dá números diferentes é a lição sobre variância.
      const tentativas = await tx.unoogptSimulacao.findMany({
        where: { escolaId, estudanteId: estudanteId },
        orderBy: { ordem: "asc" },
        select: { ordem: true, alocacao: true, desfecho: true, minutoDaSaida: true },
      });

      return {
        desfecho,
        // A FAIXA é a manchete: corridas da MESMA decisão, para "não repete
        // igual" sair do texto e virar gráfico.
        esperado: {
          media: faixa.media,
          faixa: faixa.faixa,
          vitimasMedia: faixa.vitimasMedia,
          vitimasFaixa: faixa.vitimasFaixa,
          amostras: faixa.amostras,
        },
        minutoDaSaida: sim.minutoDaSaida,
        // Um FATO com nome de bairro e número de pessoas — não um veredito.
        // Quem transforma fato em lição é o professor, no debate.
        sobrou: oQueSobrou(desfecho.porBairro, atual.conjuntos),
        // A lista do que ele NUNCA consultou é a peça mais forte do fechamento.
        // `nome` NÃO vai: é o nome técnico, e o comentário do catálogo é
        // explícito — "aparece no painel do professor, nunca para o estudante".
        // `instrucao` (o viés), `vies` e `cobertura` também não: são o
        // instrumento, e são o material do debate.
        naoConsultados: naoCarregados(atual.conjuntos).map((c) => ({
          slug: c.slug,
          comoFalar: c.comoFalar,
          rotuloCurto: c.rotuloCurto,
          serve: c.serve,
        })),
        // Cada tentativa com o desfecho e a faixa DELA: a tela compara rodadas
        // (delta de resgatados e de vítimas), e é essa comparação que ensina
        // que a mesma cidade dá números diferentes. `esperadoDe` roda por
        // tentativa — são no máximo três, e cada corrida cobre 4 bairros.
        tentativas: tentativas.map((t) => {
          const d = t.desfecho as unknown as ReturnType<typeof simular>;
          const a = t.alocacao as { alfa?: string | null; bravo?: string | null };
          const esperadoDela = esperadoDe(
            { alfa: a.alfa ?? null, bravo: a.bravo ?? null },
            { saidaEmMinutos: t.minutoDaSaida },
            200,
          );
          return {
            ordem: t.ordem,
            alocacao: { alfa: a.alfa ?? null, bravo: a.bravo ?? null },
            minutoDaSaida: t.minutoDaSaida,
            emRisco: d.totais.emRisco,
            salvas: d.totais.salvas,
            vitimas: d.totais.vitimas,
            desfecho: d,
            esperado: {
              media: esperadoDela.media,
              faixa: esperadoDela.faixa,
              vitimasMedia: esperadoDela.vitimasMedia,
              vitimasFaixa: esperadoDela.vitimasFaixa,
              amostras: esperadoDela.amostras,
            },
          };
        }),
        trilha: marcos,
        justificativas: { alfa: atual.justificativaAlfa, bravo: atual.justificativaBravo },
      };
    }, escolaId);
  }

  // =========================================================================
  // Helpers privados
  // =========================================================================

  /**
   * Semente do sorteio. Estável por (escola, estudante): o professor abre a mesma
   * partida e vê os mesmos números. O que NÃO é estável é a tentativa seguinte
   * — cada uma sorteia de novo, e é aí que mora a lição.
   */
  private semente(escolaId: string, estudanteId: string): string {
    return `${escolaId}:${estudanteId}`;
  }

  /** Lock consultivo por sessão: duas abas não gravam o mesmo turno duas vezes. */
  private async lock(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${escolaId}:${estudanteId}`}, 0))`;
  }

  private async garantirSessao(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    // `users`/`turmas` estão FORA da RLS: a checagem da escola é explícita.
    const estudante = await tx.user.findUnique({
      where: { id: estudanteId },
      select: { escolaId: true, turmaId: true },
    });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("sessao-encerrada");

    const existente = await tx.unoogptSessao.findUnique({
      where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
    });
    if (existente) return existente;

    /* A PORTA DA SALA (ADR-69), e ela fica na CRIAÇÃO, não em toda rota.
       Quem já entrou fica: encerrar a missão fecha a entrada, não expulsa a
       criança no meio da aula. Aqui é o funil — nenhuma rota desta experiência
       funciona sem passar por `garantirSessao`, então não há porta lateral. */
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);

    return tx.unoogptSessao.create({ data: { escolaId, estudanteId: estudanteId, turmaId: estudante.turmaId } });
  }

  /**
   * O relógio que vale para esta sessão: o da TURMA.
   *
   * Estudante sem turma — dev, seed, estudante solto — cai no relógio padrão PARADO.
   * Isto é deliberado: o fallback do projeto de origem armava um cronômetro
   * individual, e com ele um estudante sem turma jogava sozinho sem a largada. Aqui
   * ele vê "aguardando", que é a verdade.
   */
  private async relogioDaTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
  ): Promise<RelogioDaTurma> {
    if (!turmaId) return { ...RELOGIO_PADRAO };
    const linha = await tx.unoogptRelogioTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
    });
    if (!linha) return { ...RELOGIO_PADRAO };
    return {
      modo: linha.modo as RelogioDaTurma["modo"],
      iniciadoEm: linha.iniciadoEm,
      duracaoSeg: linha.duracaoSeg,
      encerradoEm: linha.encerradoEm,
      pivoSeg: linha.pivoSeg,
      pivoMin: linha.pivoMin,
    };
  }

  /**
   * O estado do relógio da turma NESTE instante. É o que todo marco e toda
   * mutação direta precisam — `sessoes.minutos_gastos` é um retrato do último
   * turno, não a hora.
   */
  private async relogioAgora(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string | null,
    agora: Date = new Date(),
  ): Promise<EstadoDoRelogio> {
    return estadoDoRelogio(await this.relogioDaTurma(tx, escolaId, turmaId), agora);
  }

  private async historico(escolaId: string, estudanteId: string, tentativa: number) {
    return this.prisma.comTenancy(async (tx) => {
      const falas = await tx.unoogptMensagem.findMany({
        where: { escolaId, estudanteId: estudanteId, tentativa },
        orderBy: { id: "asc" },
        select: { papel: true, texto: true },
      });
      return falas.map((f) => ({ papel: f.papel as "estudante" | "agente", texto: f.texto }));
    }, escolaId);
  }

  /**
   * Grava um marco na trilha, com a ordem seguinte dentro da tentativa — e o
   * relógio do INSTANTE junto: o cronômetro que o estudante via e, se já tinha
   * fechado, por quê. Reconstruir isso depois é inviável ("+2 min" muda a
   * duração sem histórico; "zerar" apaga o relógio), então grava-se agora.
   */
  private async gravarMarco(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    tentativa: number,
    marco: Marco,
    estado: EstadoDoRelogio,
  ) {
    const anteriores = await tx.unoogptMarco.count({ where: { escolaId, estudanteId: estudanteId, tentativa } });
    await tx.unoogptMarco.create({
      data: {
        escolaId,
        estudanteId: estudanteId,
        tentativa,
        ordem: anteriores + 1,
        tipo: marco.tipo,
        minuto: marco.minuto,
        segundosRestantes: estado.segundosAteFechar === null ? null : Math.ceil(estado.segundosAteFechar),
        motivoDoFim: estado.motivoDoFim,
        dados: marco.dados as Prisma.InputJsonValue,
      },
    });
  }

  // =========================================================================
  // Professor — o relógio da aula e a leitura da turma
  //
  // Nenhuma destas funções fala com a Sessão de ninguém: o Passo continua sendo
  // do clique do estudante, e o que o professor controla é só QUANDO dá para falar.
  // =========================================================================

  /**
   * Mexer no relógio da aula. Cinco ações, todas por turma e todas dentro da
   * escola de quem está olhando.
   *
   * `largada` é IDEMPOTENTE de propósito: apertar duas vezes não rebobina a
   * aula da turma inteira — e é exatamente o clique que um professor nervoso dá
   * duas vezes.
   */
  async mexerNoRelogio(
    escolaId: string,
    turmaId: string,
    acao: "largada" | "mais-tempo" | "encerrar" | "modo-livre" | "modo-cronometrado" | "redefinir",
    professorId?: string,
  ) {
    const agora = new Date();
    return this.prisma.comTenancy(async (tx) => {
      /* O `professorId` não estava aqui, e este é o relógio DA AULA: sem ele,
         um professor da escola dava a largada — ou encerrava — a aula de uma
         turma que não é dele, no meio dela. */
      await this.turmaDaEscola(tx, escolaId, turmaId, professorId);
      const atual =
        (await tx.unoogptRelogioTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } })) ??
        (await tx.unoogptRelogioTurma.create({ data: { escolaId, turmaId } }));

      const relogio: RelogioDaTurma = {
        modo: atual.modo as RelogioDaTurma["modo"],
        iniciadoEm: atual.iniciadoEm,
        duracaoSeg: atual.duracaoSeg,
        encerradoEm: atual.encerradoEm,
        pivoSeg: atual.pivoSeg,
        pivoMin: atual.pivoMin,
      };

      const dados: Prisma.UnoogptRelogioTurmaUpdateInput = {};
      if (acao === "largada") {
        if (atual.iniciadoEm) return this.retratoDoRelogio(relogio, agora);
        dados.iniciadoEm = agora;
        dados.encerradoEm = null;
      } else if (acao === "mais-tempo") {
        if (!atual.iniciadoEm) throw erroDeJogo("relogio-nao-comecou");
        // O PIVÔ: sem ele o minuto da cidade REBOBINA. Aos 4:00 de 5:00 o estudante
        // está no minuto 48, e recalcular com 7:00 daria 34 — a chuva andaria
        // para trás na cara da turma.
        const pivo = pivoParaEstender(relogio, agora);
        dados.duracaoSeg = atual.duracaoSeg + INCREMENTO_SEG;
        dados.pivoSeg = pivo.pivoSeg;
        dados.pivoMin = pivo.pivoMin;
        dados.encerradoEm = null;
      } else if (acao === "encerrar") {
        if (!atual.iniciadoEm) throw erroDeJogo("relogio-nao-comecou");
        if (!atual.encerradoEm) dados.encerradoEm = agora;
      } else if (acao === "modo-livre" || acao === "modo-cronometrado") {
        dados.modo = acao === "modo-livre" ? "livre" : "cronometrado";
      } else {
        // Redefinir devolve o relógio ao estado de antes da aula. Não apaga
        // partida nenhuma: quem faz isso é `zerarTurma`.
        dados.iniciadoEm = null;
        dados.encerradoEm = null;
        dados.duracaoSeg = RELOGIO.duracaoRealEmSegundos;
        dados.pivoSeg = 0;
        dados.pivoMin = 0;
      }

      const salvo = await tx.unoogptRelogioTurma.update({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        data: dados,
      });
      return this.retratoDoRelogio(
        {
          modo: salvo.modo as RelogioDaTurma["modo"],
          iniciadoEm: salvo.iniciadoEm,
          duracaoSeg: salvo.duracaoSeg,
          encerradoEm: salvo.encerradoEm,
          pivoSeg: salvo.pivoSeg,
          pivoMin: salvo.pivoMin,
        },
        agora,
      );
    }, escolaId);
  }

  /**
   * As turmas da escola — alimenta o seletor da página de resultados.
   *
   * NOTA: `unootube.service.ts` tem uma função idêntica. É duplicação real, e a
   * saída não é uma delas importar a outra (acoplaria duas experiências) — é uma
   * rota de plataforma para listar turmas, que ainda não existe. Quando a
   * terceira experiência precisar disto, vale criá-la.
   */
  /** `professorId` presente = só as turmas dele (ver `ondeAsTurmasSaoVisiveis`). */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({
          id: t.id,
          nome: t.nome,
          serie: t.serie,
          estudantes: t._count.estudantes,
        })),
      };
    }, escolaId);
  }

  /**
   * A folha da turma.
   *
   * NENHUMA coluna ordenável por "acerto": listagem é ordenável, e uma coluna
   * de resgatados viraria ranking de crianças. O que a lista mostra é conduta —
   * se leu antes de decidir, se viu fontes discordando, se justificou por
   * intuição — e o número de resgate fica na tela individual, uma por vez.
   *
   * UMA LINHA POR COMPUTADOR (E13, ADR-111): com equipes montadas para esta
   * missão, os membros de cada uma viram UMA linha, a de quem entrou (o mais
   * recente, se mais de um entrou), e o retrato conta essas linhas. Sem isso,
   * quem senta ao lado de quem digita contava como "não começou". Sem equipes,
   * cada estudante é a própria linha, como antes. O mapa é lido DENTRO do
   * `comTenancy` — fora dele a RLS das equipes devolve vazio, em silêncio.
   */
  async turmaDoProfessor(escolaId: string, turmaId: string, professorId?: string) {
    const agora = new Date();
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaDaEscola(tx, escolaId, turmaId, professorId);
      const relogio = await this.relogioDaTurma(tx, escolaId, turmaId);

      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        orderBy: { username: "asc" },
        select: { id: true, displayName: true, username: true },
      });

      const atualizadoEm = new Map<string, number>();
      const porEstudante = await Promise.all(
        estudantes.map(async (a) => {
          const sinais = await this.sinaisDaPartida(tx, escolaId, a.id);
          atualizadoEm.set(a.id, sinais.atualizadoEm?.getTime() ?? 0);
          return {
            id: a.id,
            estudanteId: a.id,
            nome: a.displayName,
            usuario: a.username,
            comecou: sinais.comecou,
            concluiu: sinais.concluiu,
            fontesDistintas: sinais.fontesDistintas,
            leituras: sinais.leituras,
            viuConflito: sinais.leiturasComConflito > 0,
            // "Decidiu no escuro": definiu destino sem ter cruzado dado nenhum.
            decidiuNoEscuro: sinais.decidiu && !sinais.decidiuDepoisDeLer,
            justificouPorIntuicao: sinais.justificouPorIntuicao,
            tentativas: sinais.tentativas,
          };
        }),
      );

      const mapa = await mapaDeEquipes(tx, escolaId, turmaId, EXP_ID);
      const linhas = colapsarEmUnidades(
        porEstudante,
        (l) => l.estudanteId,
        mapa,
        (l) => l.comecou,
        (l) => atualizadoEm.get(l.estudanteId) ?? 0,
      ).map((u) => ({ ...u.linha, equipe: u.equipe }));

      return {
        turma: { id: turma.id, nome: turma.nome, serie: turma.serie },
        relogio: this.retratoDoRelogio(relogio, agora),
        // O RETRATO da turma, e ele fala de conduta, não de nota.
        retrato: {
          estudantes: linhas.length,
          comecaram: linhas.filter((l) => l.comecou).length,
          concluiram: linhas.filter((l) => l.concluiu).length,
          viramConflito: linhas.filter((l) => l.viuConflito).length,
          decidiramNoEscuro: linhas.filter((l) => l.decidiuNoEscuro).length,
          justificaramPorIntuicao: linhas.filter((l) => l.justificouPorIntuicao).length,
          porComputador: mapa.size > 0,
        },
        linhas,
      };
    }, escolaId);
  }

  /**
   * A linha de UMA criança: o relatório em graus, e a Transcrição.
   *
   * Só o professor da escola chega aqui — não há rota de gestor para esta
   * função, e isso é controller separado, não `@Roles` misto com exceção por
   * método. A transcrição é caixa livre escrita por menor de idade.
   */
  async doEstudante(escolaId: string, estudanteId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const estudante = await tx.user.findFirst({
        where: { id: estudanteId, escolaId, role: "estudante" },
        select: { id: true, displayName: true, turmaId: true },
      });
      if (!estudante) throw erroDeJogo("sessao-encerrada");
      /* A criança tem de ser de uma turma DELE — esta tela carrega a
         Transcrição, texto livre escrito por menor de idade. O erro é o MESMO
         de estudante inexistente, de propósito: negar sem confirmar quem existe. */
      if (!(await professorEnsinaOEstudante(tx, escolaId, estudanteId, professorId))) {
        throw erroDeJogo("sessao-encerrada");
      }

      const sinais = await this.sinaisDaPartida(tx, escolaId, estudanteId);
      const linhas = linhasDeLeitura(sinais);

      const simulacoes = await tx.unoogptSimulacao.findMany({
        where: { escolaId, estudanteId },
        orderBy: { ordem: "asc" },
        select: { ordem: true, alocacao: true, desfecho: true, esperado: true, minutoDaSaida: true, criadoEm: true },
      });
      const falas = await tx.unoogptMensagem.findMany({
        where: { escolaId, estudanteId },
        orderBy: { id: "asc" },
        select: { papel: true, texto: true, tentativa: true, debitou: true, criadoEm: true },
      });
      const marcos = await tx.unoogptMarco.findMany({
        where: { escolaId, estudanteId },
        orderBy: [{ tentativa: "asc" }, { ordem: "asc" }],
        select: {
          tentativa: true,
          ordem: true,
          tipo: true,
          minuto: true,
          segundosRestantes: true,
          motivoDoFim: true,
          criadoEm: true,
          dados: true,
        },
      });
      const sessao = await tx.unoogptSessao.findUnique({
        where: { escolaId_estudanteId: { escolaId, estudanteId } },
      });
      // A largada ATUAL da turma. "Redefinir" apaga a anterior, e aí os tempos
      // "desde a largada" de uma aula passada deixam de fazer sentido — o marco
      // `inicio` guarda o cronômetro por isso.
      const largada = sessao ? (await this.relogioDaTurma(tx, escolaId, sessao.turmaId)).iniciadoEm : null;
      const segundosEntre = (de: Date | null, ate: Date | null) =>
        de && ate ? Math.round((ate.getTime() - de.getTime()) / 1000) : null;

      // Toda tentativa que deixou rastro, enfrentada ou não: quem recomeçou no
      // meio não tem simulação, mas tem conversa e marcos.
      const numeros = new Set<number>();
      for (const m of marcos) numeros.add(m.tentativa);
      for (const f of falas) numeros.add(f.tentativa);
      for (const s of simulacoes) numeros.add(s.ordem);
      if (sessao) numeros.add(sessao.tentativa);

      const rodadas = [...numeros]
        .sort((a, b) => a - b)
        .map((n) => {
          const daRodada = marcos.filter((m) => m.tentativa === n);
          const inicio = daRodada.find((m) => m.tipo === "inicio") ?? null;
          const envio = daRodada.find((m) => m.tipo === "envio") ?? null;
          const recomeco = daRodada.find((m) => m.tipo === "recomeco") ?? null;
          const primeiraFala = falas.find((f) => f.tentativa === n && f.papel === "estudante") ?? null;
          const dadosRecomeco = (recomeco?.dados ?? null) as {
            origem?: "investigacao" | "resultado" | null;
            fase?: "aguardando" | "correndo" | "encerrado";
            modo?: "cronometrado" | "livre";
          } | null;
          return {
            tentativa: n,
            inicioEm: inicio?.criadoEm.toISOString() ?? null,
            primeiraFalaEm: primeiraFala?.criadoEm.toISOString() ?? null,
            // Dois relógios, de propósito: antes da largada o campo está
            // bloqueado, então "desde o Começar" mede o professor, não o
            // estudante. O PO escolhe qual exibe.
            ateAPrimeiraFala: primeiraFala
              ? {
                  desdeOComecar: segundosEntre(inicio?.criadoEm ?? null, primeiraFala.criadoEm),
                  desdeALargada: segundosEntre(largada, primeiraFala.criadoEm),
                }
              : null,
            mudancasDeDestino: mudancasDeDestino(daRodada),
            enfrentou: simulacoes.some((s) => s.ordem === n),
            envio: envio
              ? {
                  em: envio.criadoEm.toISOString(),
                  minuto: envio.minuto,
                  segundosRestantes: envio.segundosRestantes,
                  motivoDoFim: envio.motivoDoFim as "tempo" | "professor" | null,
                  // Estourou = o relógio já tinha fechado quando confirmou.
                  estourou: envio.motivoDoFim !== null,
                }
              : null,
            recomeco: recomeco
              ? {
                  em: recomeco.criadoEm.toISOString(),
                  origem: dadosRecomeco?.origem ?? null,
                  fase: dadosRecomeco?.fase ?? null,
                  modo: dadosRecomeco?.modo ?? null,
                  segundosRestantes: recomeco.segundosRestantes,
                  motivoDoFim: recomeco.motivoDoFim as "tempo" | "professor" | null,
                }
              : null,
          };
        });

      const tentativas = simulacoes.map((t) => {
        const d = t.desfecho as unknown as ReturnType<typeof simular>;
        const a = t.alocacao as { alfa?: string | null; bravo?: string | null };
        const alocacao = { alfa: a.alfa ?? null, bravo: a.bravo ?? null };
        // Gravado no confirmar; simulação anterior à coluna recomputa (é
        // determinístico — semente por alocação e índice).
        const gravado = t.esperado as {
          media: number;
          faixa: [number, number];
          vitimasMedia: number;
          vitimasFaixa: [number, number];
          amostras: number[];
          percentil?: number | null;
        } | null;
        const esperado =
          gravado ??
          (() => {
            const e = esperadoDe(alocacao, { saidaEmMinutos: t.minutoDaSaida }, 200);
            return {
              media: e.media,
              faixa: e.faixa as [number, number],
              vitimasMedia: e.vitimasMedia,
              vitimasFaixa: e.vitimasFaixa as [number, number],
              amostras: e.amostras,
              percentil: percentilEntre(d.totais.salvas, e.todas),
            };
          })();
        const envio = marcos.find((m) => m.tentativa === t.ordem && m.tipo === "envio");
        const noEnvio = (envio?.dados as { justificativas?: { alfa: string; bravo: string } } | undefined)
          ?.justificativas;
        // Envio anterior à cópia no marco: a sessão ainda tem as da tentativa
        // corrente; das anteriores, `reiniciar` já apagou.
        const justificativas =
          noEnvio ??
          (sessao && sessao.tentativa === t.ordem
            ? { alfa: comoOProfessorLe(sessao.justificativaAlfa), bravo: comoOProfessorLe(sessao.justificativaBravo) }
            : null);
        return {
          ordem: t.ordem,
          alocacao,
          minutoDaSaida: t.minutoDaSaida,
          criadoEm: t.criadoEm.toISOString(),
          emRisco: d.totais.emRisco,
          salvas: d.totais.salvas,
          vitimas: d.totais.vitimas,
          semSocorro: d.totais.semSocorro,
          coberturaDoRisco: coberturaDoRisco(d),
          esperado: {
            media: esperado.media,
            faixa: esperado.faixa,
            vitimasMedia: esperado.vitimasMedia,
            vitimasFaixa: esperado.vitimasFaixa,
            amostras: esperado.amostras,
          },
          posicao: posicaoNaFaixa(d.totais.salvas, esperado),
          justificativas,
        };
      });

      return {
        estudante: { id: estudante.id, nome: estudante.displayName },
        versaoLeitura: VERSAO_LEITURA,
        // O relatório abre pelo que a missão MEDIU, em graus — e `zero` ("teve
        // a chance e não foi") nunca se confunde com `none` ("a oportunidade
        // não chegou"). É a distinção mais importante do modelo.
        linhas,
        porGrau: contarPorGrau(linhas),
        resumo: resumoHonesto(sinais, linhas),
        justificativas: sessao
          ? {
              alfa: comoOProfessorLe(sessao.justificativaAlfa),
              bravo: comoOProfessorLe(sessao.justificativaBravo),
            }
          : null,
        tentativas,
        rodadas,
        trilha: marcos.map((m) => ({
          tentativa: m.tentativa,
          ordem: m.ordem,
          tipo: m.tipo,
          minuto: m.minuto,
          segundosRestantes: m.segundosRestantes,
          motivoDoFim: m.motivoDoFim as "tempo" | "professor" | null,
          criadoEm: m.criadoEm.toISOString(),
          dados: m.dados,
        })),
        conversa: falas.map((f) => ({
          papel: f.papel as "estudante" | "agente",
          texto: f.texto,
          tentativa: f.tentativa,
          debitou: f.debitou,
          criadoEm: f.criadoEm.toISOString(),
          // "Aos 0:42 da aula": o relógio que o professor tem na cabeça.
          segundosDesdeALargada: segundosEntre(largada, f.criadoEm),
        })),
      };
    }, escolaId);
  }

  /**
   * Zerar a turma: apaga as partidas E o relógio.
   *
   * É o caminho de exclusão que substitui o `expires_at` do projeto de origem —
   * um prazo real, apertado por quem tem a posse pedagógica, em vez de uma
   * coluna que nenhuma rotina cumpre.
   *
   * O relógio vai junto porque rodar de novo com a aula "já começada" faria a
   * segunda rodada nascer no meio da tempestade.
   */
  async zerarTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaDaEscola(tx, escolaId, turmaId, professorId);
      const estudantes = await tx.user.findMany({
        where: { escolaId, turmaId, role: "estudante" },
        select: { id: true },
      });
      const ids = estudantes.map((a) => a.id);
      // As tabelas filhas caem por ON DELETE CASCADE da sessão.
      const { count } = await tx.unoogptSessao.deleteMany({
        where: { escolaId, estudanteId: { in: ids } },
      });
      await tx.unoogptRelogioTurma.deleteMany({ where: { escolaId, turmaId } });
      return { partidasApagadas: count, relogioRedefinido: true };
    }, escolaId);
  }

  /**
   * O agregado da escola, para o gestor: SÓ números por turma.
   *
   * Nenhuma linha de estudante passa por aqui. Quem quiser a criança precisa da
   * rota do professor, que é outro controller com outro `@Roles`.
   */
  async agregadoDaEscola(escolaId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: { escolaId },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, serie: true },
      });
      const linhas = await Promise.all(
        turmas.map(async (t) => {
          const sessoes = await tx.unoogptSessao.count({ where: { escolaId, turmaId: t.id } });
          const concluidas = await tx.unoogptSessao.count({
            where: { escolaId, turmaId: t.id, concluidoEm: { not: null } },
          });
          return { turma: t.nome, serie: t.serie, partidas: sessoes, concluidas };
        }),
      );
      return { versaoLeitura: VERSAO_LEITURA, turmas: linhas };
    }, escolaId);
  }

  // =========================================================================

  /** `turmas` está FORA da RLS: a checagem da escola é explícita. */
  /**
   * Turma da escola — e, quando quem pede é PROFESSOR, turma em que ele tem
   * matrícula. O erro é o mesmo de turma inexistente de propósito: quem não dá
   * aula ali não precisa descobrir que ela existe.
   */
  private async turmaDaEscola(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    professorId?: string,
  ) {
    const turma = await tx.turma.findFirst({
      where: { id: turmaId, escolaId },
      select: { id: true, nome: true, serie: true },
    });
    if (!turma) throw erroDeJogo("sessao-encerrada");
    if (!(await professorLeciona(tx, escolaId, turmaId, professorId))) {
      throw erroDeJogo("sessao-encerrada");
    }
    return turma;
  }

  private retratoDoRelogio(relogio: RelogioDaTurma, agora: Date) {
    const estado = estadoDoRelogio(relogio, agora);
    return {
      ...sanitizarRelogio(relogio, agora),
      fase: estado.fase,
      minutosGastos: estado.minutosGastos,
      segundosAteFechar: estado.segundosAteFechar,
      motivoDoFim: estado.motivoDoFim,
      incrementoSeg: INCREMENTO_SEG,
    };
  }

  /**
   * Os sinais de uma partida, lidos do banco.
   *
   * `comecou` é o que separa `zero` de `none` na leitura: sem a missão ter
   * começado, TUDO é `none` — "a oportunidade não chegou" — e nada é zero.
   */
  private async sinaisDaPartida(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
  ): Promise<SinaisDaPartida & { justificouPorIntuicao: boolean; atualizadoEm: Date | null }> {
    const sessao = await tx.unoogptSessao.findUnique({
      where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
    });
    const marcos = sessao
      ? await tx.unoogptMarco.findMany({
          where: { escolaId, estudanteId: estudanteId },
          orderBy: [{ tentativa: "asc" }, { ordem: "asc" }],
          select: { tipo: true, ordem: true, tentativa: true, dados: true },
        })
      : [];
    const simulacoes = sessao
      ? await tx.unoogptSimulacao.findMany({
          where: { escolaId, estudanteId: estudanteId },
          orderBy: { ordem: "asc" },
          select: { desfecho: true },
        })
      : [];

    const fontes = new Set<string>();
    for (const m of marcos) {
      if (m.tipo !== "fontes") continue;
      const dados = m.dados as { somadas?: string[] } | null;
      for (const f of dados?.somadas ?? []) fontes.add(f);
    }
    const leituras = marcos.filter((m) => m.tipo === "leitura");
    const comConflito = leituras.filter((m) => {
      const dados = m.dados as { conflitos?: unknown[] } | null;
      return (dados?.conflitos ?? []).length > 0;
    });

    // "Decidiu depois de ler" é ORDEM, não contagem: a primeira alocação tem de
    // vir DEPOIS de alguma leitura. Contar os dois e comparar totais diria que
    // quem decidiu no escuro e leu no fim tinha lido antes.
    const primeiraAlocacao = marcos.find((m) => m.tipo === "alocacao");
    const primeiraLeitura = leituras[0];
    const decidiuDepoisDeLer =
      primeiraAlocacao !== undefined &&
      primeiraLeitura !== undefined &&
      (primeiraLeitura.tentativa < primeiraAlocacao.tentativa ||
        (primeiraLeitura.tentativa === primeiraAlocacao.tentativa &&
          primeiraLeitura.ordem < primeiraAlocacao.ordem));

    return {
      fontesDistintas: fontes.size,
      leituras: leituras.length,
      leiturasComConflito: comConflito.length,
      decidiuDepoisDeLer,
      decidiu: primeiraAlocacao !== undefined,
      tentativas: simulacoes.length,
      resgatadasPorTentativa: simulacoes.map(
        (s) => (s.desfecho as { totais?: { salvas?: number } } | null)?.totais?.salvas ?? 0,
      ),
      comecou: marcos.length > 0 || (sessao?.passo ?? "abertura") !== "abertura",
      concluiu: simulacoes.length > 0,
      justificouPorIntuicao:
        sessao?.justificativaAlfa === INTUICAO || sessao?.justificativaBravo === INTUICAO,
      /* Só para o painel escolher o representante de uma equipe de computador
         (o login mais recente). Não vai para resposta nenhuma. */
      atualizadoEm: sessao?.atualizadoEm ?? null,
    };
  }

  private async estadoPublico(escolaId: string, estudanteId: string, conjuntos: string[]) {
    return this.prisma.comTenancy(async (tx) => {
      const atual = await tx.unoogptSessao.findUniqueOrThrow({
        where: { escolaId_estudanteId: { escolaId, estudanteId: estudanteId } },
      });
      return {
        sessao: sanitizarSessao(atual),
        mapa: montarMapa(this.semente(escolaId, estudanteId), atual.rodadas, conjuntos, atual.minutosGastos).bairros,
        justificativas: opcoesDeJustificativa(conjuntos),
      };
    }, escolaId);
  }
}

/** Reexportado para o controller montar o Zod do contrafactual. */
export const BAIRROS_VALIDOS = MISSAO_TEMPESTADE.bairros.map((b) => b.slug) as [string, ...string[]];
export const CONJUNTOS_VALIDOS = CONJUNTOS.map((c) => c.slug) as [string, ...string[]];
export const JUSTIFICATIVAS_VALIDAS = [...CONJUNTOS_VALIDOS, INTUICAO] as [string, ...string[]];
export { RELOGIO, pivoParaEstender };
