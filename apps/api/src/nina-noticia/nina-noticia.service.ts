import { Injectable } from "@nestjs/common";
import { Prisma, type Exp03ef1bSessao } from "@prisma/client";
import { z } from "zod";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { computadoresDaMontagem, mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades } from "../equipes/regras";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { EvidenciasService } from "../evidencias/evidencias.service";
import type { Nivel } from "../evidencias/regras";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import { ASSUNTOS_DO_BANCO_PADRAO, DISCIPLINA_DO_BANCO_PADRAO, conteudoDoBancoPadrao } from "./banco-padrao";
import {
  CARTOES_DA_MISSAO,
  DESAFIO_EXTRA,
  FERRAMENTAS,
  FICHAS_TESTE,
  GATILHOS_DE_CONDUCAO,
  MATERIAS_DO_CASO,
  ROTEIRO_DE_MEDIACAO,
  TEMA_DO_CASO,
  aplicarEstrutura,
  type ConteudoDoPacote,
  type Ficha,
} from "./conteudo";
import { ReportagemDoPacoteSchema } from "./contrato-de-rotas";
import { erroDeJogo, type CodigoErro } from "./erros";
import { completos, type CarimbosDaEtapa } from "./regras/carimbos";
import {
  MARCADOR_DA_INSPECAO,
  MARCADOR_DA_PREVISAO,
  MARCADOR_DA_ROTINA,
  MARCADOR_DOS_CARIMBOS,
  MARCADOR_DO_REPARO,
  nivelDaInspecao,
  nivelDaPrevisao,
  nivelDaRotina,
  nivelDoReparo,
  nivelDosCarimbos,
} from "./regras/evidencia";
import { aplicarFiltro, buscar, valorDoCampo } from "./regras/filtro";
import { CHAVES_DA_MIDIA, imagensDoPacote, midiaDaLinha, resumoDaMidia, type ChaveDaMidia } from "./regras/imagens";
import { sementeDaSessao } from "./regras/ordem";
import { alertasDaLinha, contagemPorEtapaVisivel, distribuicaoDasEscolhas } from "./regras/painel";
import {
  ETAPA_INICIAL,
  PASSO_INICIAL,
  aguardandoOProfessor,
  normalizarEtapa,
  normalizarPasso,
  ordemDoPasso,
  passoEfetivo,
  passoNoMinimo,
  pedirPasso,
  podeAgir,
  proximaEtapa,
  transicaoDoGate,
  type PassoPedido,
  type PedidoDoGate,
} from "./regras/passos";
import { corrigirReparo, etiquetasDaSessao, type FichaMontada } from "./regras/reparo";
import { idsDosSuportes, reportagensDaSessao, selosCompletos, suportesDosIds, travarPrevisao } from "./regras/reportagens";
import { bandejaDaSessao, corrigirRotina, simularRotina } from "./regras/rotina";
import {
  CARIMBOS,
  CARTOES_DA_INSPECAO,
  CARTOES_DO_CASO,
  DISCIPLINAS,
  ETAPA_VISIVEL_DO_PASSO,
  ETIQUETAS,
  EXP_ID,
  LUGAR_DO_EVENTO,
  ORIGENS_DO_PACOTE,
  ROTULO_DO_BLOCO,
  ROTULO_DO_LUGAR_DO_EVENTO,
  ROTULO_DO_SUPORTE,
  ROTULO_DO_VALOR,
  SEQUENCIA_CERTA,
  SUPORTES,
  SUPORTE_OMITIDO,
  VERSAO_DO_INSTRUMENTO,
  type Campo,
  type Carimbo,
  type Disciplina,
  type Etapa,
  type EtapaDosCarimbos,
  type Etiqueta,
  type OrigemDoPacote,
  type Passo,
  type Suporte,
} from "./vocabulario";

export { EXP_ID } from "./vocabulario";

/**
 * Persistência e regras aplicadas da exp03ef1b — Nina e a Notícia que
 * Desapareceu. Molde: `juri-estadual/juri-estadual.service.ts` (o funil, os
 * locks, o gate da turma, atividade × rodada, o painel por computador).
 *
 * Assinaturas recebem `escolaId`/`estudanteId` explícitos, não o request: toda
 * query leva `escola_id` no `where` ALÉM da RLS que o `comTenancy` arma (regra
 * inviolável nº 1, defesa em profundidade).
 *
 * **Os gabaritos nunca descem** (regra 3): os carimbos K1–K6, a sequência da
 * rotina e a regra do reparo ficam em `regras/`, e a saída do estudante é a
 * allowlist de `contrato-de-rotas.ts`. Reportagens, etiquetas e blocos viajam
 * por ids OPACOS da sessão (`regras/ordem.ts`), e o que se grava é o suporte,
 * a etiqueta e o bloco.
 *
 * **Dois relógios** (`regras/passos.ts`): o da turma (etapa + pausa, que a
 * professora move) e o passo da sessão. Toda jogada passa por `podeAgir` com o
 * gate RELIDO depois do lock compartilhado da turma: pausada é 409
 * `turma-pausada`, além do teto é 403 `etapa-nao-liberada`, a rodada trocada no
 * meio é 409 `rodada-mudou`.
 */

/** Como o pacote é LIDO do JSONB: a forma, sem a régua da homologação (que apertar depois não derruba a aula). */
const LeituraDoConteudoSchema = z.object({
  tema: z.string(),
  cartaz: z.object({ texto: z.string(), imagem: z.object({ descricao: z.string(), alt: z.string() }) }),
  reportagens: z.array(ReportagemDoPacoteSchema).length(SUPORTES.length),
});

export interface PacoteLido {
  id: string;
  escolaId: string;
  turmaId: string;
  disciplina: Disciplina;
  tema: string;
  assuntos: string;
  contexto: string | null;
  origem: OrigemDoPacote;
  conteudo: ConteudoDoPacote;
  midia: Partial<Record<ChaveDaMidia, string>>;
}

interface GateLido {
  pacoteId: string;
  rodada: number;
  etapa: Etapa;
  pausada: boolean;
  atualizadoEm: Date;
}

interface ContextoDoEstudante {
  turmaId: string;
  gate: GateLido;
  pacote: PacoteLido;
  sessao: Exp03ef1bSessao;
}

const SELECAO_DO_PACOTE = {
  id: true,
  escolaId: true,
  turmaId: true,
  origem: true,
  disciplina: true,
  tema: true,
  assuntos: true,
  contexto: true,
  conteudo: true,
  midia: true,
} satisfies Prisma.Exp03ef1bPacoteSelect;

function ehOrigem(valor: string): valor is OrigemDoPacote {
  return (ORIGENS_DO_PACOTE as readonly string[]).includes(valor);
}

function ehDisciplina(valor: string): valor is Disciplina {
  return (DISCIPLINAS as readonly string[]).includes(valor);
}

function ehSuporte(valor: string): valor is Suporte {
  return (SUPORTES as readonly string[]).includes(valor);
}

/**
 * O conteúdo do `Json`, com a ESTRUTURA do servidor posta de novo por cima:
 * mesmo uma linha antiga ou torta sai com as fichas certas (o telão com Onde
 * vazio). Forma irreconhecível é a porta fechada, com o log que impede o "a
 * missão sumiu" de ser mudo.
 */
function conteudoDaLinha(bruto: Prisma.JsonValue, contexto: { escolaId: string; pacoteId: string }): ConteudoDoPacote {
  const lido = LeituraDoConteudoSchema.safeParse(bruto);
  if (lido.success) {
    const conteudo = aplicarEstrutura(lido.data);
    if (conteudo.reportagens.length === SUPORTES.length) return conteudo;
  }
  logger.warn({ codigo: "exp03ef1b-pacote-invalido", ...contexto }, "pacote com forma inesperada; a turma fica sem atividade");
  throw erroDeJogo("atividade-nao-preparada");
}

function pacoteDaLinha(linha: Prisma.Exp03ef1bPacoteGetPayload<{ select: typeof SELECAO_DO_PACOTE }>): PacoteLido {
  return {
    id: linha.id,
    escolaId: linha.escolaId,
    turmaId: linha.turmaId,
    disciplina: ehDisciplina(linha.disciplina) ? linha.disciplina : "projeto-interdisciplinar",
    tema: linha.tema,
    assuntos: linha.assuntos,
    contexto: linha.contexto,
    origem: ehOrigem(linha.origem) ? linha.origem : "ia",
    conteudo: conteudoDaLinha(linha.conteudo, { escolaId: linha.escolaId, pacoteId: linha.id }),
    midia: midiaDaLinha(linha.midia),
  };
}

/** JSON com as chaves em ordem: o JSONB reordena as chaves, e a comparação não pode depender disso. */
export function canonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor !== null && typeof valor === "object") {
    const chaves = Object.keys(valor as Record<string, unknown>).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${canonico((valor as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor) ?? "null";
}

/** Os carimbos gravados de uma etapa, só com cartão e carimbo conhecidos. */
function carimbosDaLinha(bruto: Prisma.JsonValue | null, etapa: EtapaDosCarimbos): CarimbosDaEtapa | null {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const cartoes = etapa === "e4" ? CARTOES_DA_INSPECAO : CARTOES_DO_CASO;
  const saida: CarimbosDaEtapa = {};
  for (const k of cartoes) {
    const v = (bruto as Record<string, unknown>)[k];
    if (typeof v === "string" && (CARIMBOS as readonly string[]).includes(v)) saida[k] = v as Carimbo;
  }
  return saida;
}

/** A ficha montada gravada (`{campo: etiqueta}`), ou `null`. */
function posicoesDaLinha(bruto: Prisma.JsonValue | null): Record<Campo, Etiqueta> | null {
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const b = bruto as Record<string, unknown>;
  const ok = (v: unknown): v is Etiqueta => typeof v === "string" && (ETIQUETAS as readonly string[]).includes(v);
  return ok(b.quem) && ok(b.onde) && ok(b.quando) ? { quem: b.quem, onde: b.onde, quando: b.quando } : null;
}

function suportesDaLinha(valores: readonly string[]): Suporte[] {
  return SUPORTES.filter((s) => valores.includes(s) && ehSuporte(s));
}

const semente = (s: Exp03ef1bSessao) => sementeDaSessao(s.id, s.rodada);

/** O resumo da PRÓPRIA sessão — o "Painel da Investigação" (E6-03). */
function resumoDaSessao(s: Exp03ef1bSessao, conteudo: ConteudoDoPacote) {
  const encontradas = buscar(conteudo.reportagens, "onde", LUGAR_DO_EVENTO);
  return {
    suportes: { escolhidas: suportesDaLinha(s.previsaoItens).length },
    omissao: { encontradas: encontradas.length, deFora: SUPORTE_OMITIDO },
    reparo: { desfecho: s.reparoValido ? ("sucesso" as const) : ("erro" as const) },
    automacao: { testes: s.rotinaTentativas },
  };
}

/** As imagens do banco que um pacote recebe: todas para o `padrao`; só as cenas fixas para o da IA. */
function imagensDoBancoPara(origem: OrigemDoPacote, banco: Readonly<Record<string, string>>): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const chave of CHAVES_DA_MIDIA) {
    const url = banco[chave];
    if (!url) continue;
    if (origem === "padrao" || chave.startsWith("caso-") || chave.startsWith("extra-")) saida[chave] = url;
  }
  return saida;
}

const PARAMETROS_ATUAIS = (p: { disciplina: Disciplina; assuntos: string; contexto?: string }) => ({
  disciplina: p.disciplina,
  assuntos: p.assuntos,
  contexto: p.contexto?.trim() || null,
});

@Injectable()
export class NinaNoticiaService {
  /*
   * Sem `registrarContexto`: a ficha é 100% ação (spec §2), e cada tarefa
   * marca pela porta `marcar`, na própria transação, com a atividade e a
   * rodada que a sessão já tem.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
  ) {}

  // ───────────────────────────────────────────────────── rotas do estudante

  /** Boot e F5: na primeira entrada da rodada, nasce a sessão. */
  async sessao(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      return this.sessaoPublica(ctx);
    }, escolaId);
  }

  /**
   * O polling de 3 s — magro: o relógio da turma e o passo efetivo DESTE
   * computador. Passa pelo funil de liberação (regras 7 e 8) e NÃO escreve: a
   * sessão nasce no `GET sessao` (sem ela, o passo é o inicial).
   */
  async gate(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.prisma.comTenancy(async (tx) => {
      await this.estudanteDaEscola(tx, escolaId, estudanteId);
      if (!turmaId) throw erroDeJogo("sem-turma");
      const gate = await this.lerGate(tx, escolaId, turmaId);
      if (!gate) throw erroDeJogo("atividade-nao-preparada");
      const sessao = await tx.exp03ef1bSessao.findFirst({
        where: { escolaId, pacoteId: gate.pacoteId, rodada: gate.rodada, estudanteId },
        select: { passo: true },
      });
      const passo = normalizarPasso(sessao?.passo ?? PASSO_INICIAL);
      return {
        pacoteId: gate.pacoteId,
        rodada: gate.rodada,
        passo: passoEfetivo(passo, gate.etapa),
        etapa: gate.etapa,
        pausada: gate.pausada,
        aguardandoOProfessor: aguardandoOProfessor(passo, gate.etapa),
      };
    }, escolaId);
  }

  /** E1: os selos "Mesma feira". Com os três, o passo vai a `aposta`. Depois da galeria, devolve o que já estava. */
  async selos(escolaId: string, estudanteId: string, turmaId: string | null, ids: readonly string[]) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      const t = suportesDosIds(semente(s), ids);
      if (!t.ok) throw erroDeJogo(t.codigo);
      let atual = s;
      if (normalizarPasso(s.passo) === "galeria") {
        this.exigirPasso(s, gate, "galeria");
        const selos = SUPORTES.filter((x) => s.selosFeira.includes(x) || t.suportes.includes(x));
        atual = await tx.exp03ef1bSessao.update({
          where: { id: s.id },
          data: { selosFeira: selos, passo: selosCompletos(selos) ? "aposta" : "galeria" },
        });
      }
      return { ...this.estado(atual, gate), selos: idsDosSuportes(semente(atual), suportesDaLinha(atual.selosFeira)) };
    });
  }

  /**
   * E2 — o "Travar Escolha", o LATCH. Uma vez só: a segunda (inclusive duas
   * simultâneas, que o lock por estudante põe em fila) é 409
   * `previsao-ja-travada`. Grava os suportes e leva o passo a `filtro` — além do
   * teto da etapa `aposta`, então a criança espera a professora.
   */
  async previsao(escolaId: string, estudanteId: string, turmaId: string | null, itens: readonly string[]) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      if (s.previsaoTravadaEm) throw erroDeJogo("previsao-ja-travada");
      this.exigirPasso(s, gate, "aposta");
      const r = travarPrevisao(semente(s), itens, false);
      if (!r.ok) throw erroDeJogo(r.codigo);
      const { count } = await tx.exp03ef1bSessao.updateMany({
        where: { id: s.id, escolaId, previsaoTravadaEm: null, passo: "aposta" },
        data: { previsaoItens: r.suportes, previsaoTravadaEm: new Date(), passo: "filtro" },
      });
      if (count === 0) throw erroDeJogo("previsao-ja-travada");
      return this.estado(await this.reler(tx, s.id), gate);
    });
  }

  /**
   * E3 — a busca do jornal, honesta (`regras/filtro.ts`). Só Onde = Pátio
   * resolve (as duas do pátio, e o passo vai à omissão); o resto devolve zero e
   * conta em `filtro_tentativas`. Depois da busca certa, buscar de novo só
   * responde, sem contar.
   */
  async filtro(escolaId: string, estudanteId: string, turmaId: string | null, campo: Campo, valor: string) {
    if (!valorDoCampo(campo, valor)) throw erroDeJogo("valor-de-filtro-invalido");
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      const resultado = aplicarFiltro(ctx.pacote.conteudo.reportagens, campo, valor);
      let atual = s;
      if (!s.filtroAcertouEm) {
        this.exigirPasso(s, gate, "filtro");
        atual = await tx.exp03ef1bSessao.update({
          where: { id: s.id },
          data: resultado.resolveu
            ? { filtroAcertouEm: new Date(), passo: "omissao" }
            : { filtroTentativas: { increment: 1 } },
        });
      }
      return {
        ...this.estado(atual, gate),
        encontradas: idsDosSuportes(semente(s), resultado.encontradas),
        total: resultado.encontradas.length,
      };
    });
  }

  /**
   * E4-01 — a ficha do telão aberta (Onde VAZIO). Grava se o pulso de 15 s
   * disparou antes, leva o passo aos carimbos e MARCA a EF15CO08
   * (`inspecao`). Abrir de novo devolve a ficha, sem marcar outra vez.
   */
  async ficha(escolaId: string, estudanteId: string, turmaId: string | null, dica: boolean) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      let atual = s;
      if (!s.fichaAbertaEm) {
        this.exigirPasso(s, gate, "ficha");
        const { count } = await tx.exp03ef1bSessao.updateMany({
          where: { id: s.id, escolaId, fichaAbertaEm: null, passo: "ficha" },
          data: { fichaAbertaEm: new Date(), dicaInspecaoUsada: dica, passo: "carimbos" },
        });
        if (count > 0) {
          await this.marcar(
            tx,
            ctx,
            gate,
            MARCADOR_DA_INSPECAO,
            nivelDaInspecao({ fichaAberta: true, filtroTentativas: s.filtroTentativas, dicaUsada: dica }),
          );
        }
        atual = await this.reler(tx, s.id);
      }
      return { ...this.estado(atual, gate), ficha: this.fichaDoTelao(atual, ctx.pacote.conteudo) };
    });
  }

  /**
   * E4-02 e E6-01 — os três carimbos de uma etapa, uma vez cada, sem retorno de
   * acerto. Os da E4 levam o passo ao reparo; os da E6 (o caso novo) ficam no
   * passo `caso` e MARCAM a EF03CO01 com os seis (`carimbos`).
   */
  async carimbos(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    etapa: EtapaDosCarimbos,
    carimbos: CarimbosDaEtapa,
  ) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      const jaGravados = etapa === "e4" ? s.carimbosE4 : s.carimbosE6;
      if (jaGravados !== null) throw erroDeJogo("carimbos-ja-enviados");
      this.exigirPasso(s, gate, etapa === "e4" ? "carimbos" : "caso");
      if (!completos(etapa, carimbos)) throw erroDeJogo("carimbos-incompletos");
      const valor = carimbos as Prisma.InputJsonValue;
      if (etapa === "e4") {
        await tx.exp03ef1bSessao.update({ where: { id: s.id }, data: { carimbosE4: valor, passo: "reparo" } });
      } else {
        await tx.exp03ef1bSessao.update({ where: { id: s.id }, data: { carimbosE6: valor } });
        await this.marcar(tx, ctx, gate, MARCADOR_DOS_CARIMBOS, nivelDosCarimbos(carimbosDaLinha(s.carimbosE4, "e4"), carimbos));
      }
      return this.estado(await this.reler(tx, s.id), gate);
    });
  }

  /**
   * E4-03 — o "Concluir" do reparo: a ficha do telão MONTADA. Uma vez. O
   * servidor decide o desfecho (válido ⇔ Pátio em Onde) e MARCA a EF03CO03
   * (`reparo`) e a EF15CO01 (`previsao`). Os dois desfechos têm "Continuar".
   */
  async reparo(escolaId: string, estudanteId: string, turmaId: string | null, ficha: FichaMontada) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      if (s.reparoEm) throw erroDeJogo("reparo-ja-enviado");
      this.exigirPasso(s, gate, "reparo");
      const r = corrigirReparo(semente(s), ficha);
      if (!r.ok) throw erroDeJogo(r.codigo);
      const { count } = await tx.exp03ef1bSessao.updateMany({
        where: { id: s.id, escolaId, reparoEm: null, passo: "reparo" },
        data: { reparoPosicoes: r.posicoes, reparoValido: r.valido, reparoEm: new Date(), passo: "desfecho" },
      });
      if (count === 0) throw erroDeJogo("reparo-ja-enviado");
      await this.marcar(tx, ctx, gate, MARCADOR_DO_REPARO, nivelDoReparo(r.valido));
      await this.marcar(
        tx,
        ctx,
        gate,
        MARCADOR_DA_PREVISAO,
        nivelDaPrevisao({ previsaoTravada: s.previsaoTravadaEm !== null, reparoValido: r.valido }),
      );
      return { ...this.estado(await this.reler(tx, s.id), gate), desfecho: r.desfecho };
    });
  }

  /**
   * Os passos que a própria criança pede, sem dado: "Confrontar e Aguardar
   * Turma ▶" (omissão → ficha, que fica esperando a "Liberar Inspeção"), o
   * "Continuar" do desfecho (→ ponte) e o da ponte (→ rotina, gravando a ordem
   * sorteada da bandeja para auditoria). Pedir de novo devolve o estado.
   */
  async pedirPasso(escolaId: string, estudanteId: string, turmaId: string | null, para: PassoPedido) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      const atual = normalizarPasso(s.passo);
      const r = pedirPasso(atual, para);
      if (!r.ok) throw erroDeJogo(r.codigo);
      if (r.passo === atual) return this.estado(s, gate);
      this.exigirPasso(s, gate, atual);
      const extra =
        r.passo === "rotina" ? { rotinaOrdemBandeja: bandejaDaSessao(semente(s)).map((b) => b.bloco) } : {};
      await tx.exp03ef1bSessao.updateMany({ where: { id: s.id, escolaId, passo: atual }, data: { passo: r.passo, ...extra } });
      return this.estado(await this.reler(tx, s.id), gate);
    });
  }

  /**
   * E5-01 — o "Testar Rotina". Cada teste completo conta uma tentativa;
   * a válida (a sequência exata) carimba, leva o passo ao caso novo e MARCA a
   * EF03CO02 (`rotina`, contando a válida). Testar depois da válida devolve a
   * simulação, sem contar.
   */
  async rotina(escolaId: string, estudanteId: string, turmaId: string | null, sequencia: readonly string[]) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      if (s.rotinaValida) return { ...this.estado(s, gate), valida: true, simulacao: simularRotina() };
      this.exigirPasso(s, gate, "rotina");
      const r = corrigirRotina(semente(s), sequencia);
      if (!r.ok) throw erroDeJogo(r.codigo);
      const tentativas = s.rotinaTentativas + 1;
      if (!r.valida) {
        await tx.exp03ef1bSessao.update({ where: { id: s.id }, data: { rotinaTentativas: tentativas } });
        return { ...this.estado(await this.reler(tx, s.id), gate), valida: false, simulacao: null };
      }
      await tx.exp03ef1bSessao.update({
        where: { id: s.id },
        data: { rotinaTentativas: tentativas, rotinaValida: true, rotinaValidaEm: new Date(), passo: "caso" },
      });
      await this.marcar(tx, ctx, gate, MARCADOR_DA_ROTINA, nivelDaRotina({ valida: true, tentativas }));
      return { ...this.estado(await this.reler(tx, s.id), gate), valida: true, simulacao: simularRotina() };
    });
  }

  /** O fim (E6-03): exige os carimbos do caso novo. Idempotente em `fim`. */
  async concluir(escolaId: string, estudanteId: string, turmaId: string | null) {
    return this.jogar(escolaId, estudanteId, turmaId, async (tx, ctx, gate) => {
      const s = ctx.sessao;
      if (normalizarPasso(s.passo) === "fim") return { ...this.estado(s, gate), resumo: resumoDaSessao(s, ctx.pacote.conteudo) };
      this.exigirPasso(s, gate, "caso");
      if (s.carimbosE6 === null) throw erroDeJogo("carimbos-pendentes");
      /* `fim` e o carimbo no mesmo update (CHECK). */
      const atual = await tx.exp03ef1bSessao.update({
        where: { id: s.id },
        data: { passo: "fim", concluidaEm: new Date() },
      });
      return { ...this.estado(atual, gate), resumo: resumoDaSessao(atual, ctx.pacote.conteudo) };
    });
  }

  // ─────────────────────────────────────────────────────── visão do professor

  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return {
        turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, serie: t.serie, estudantes: t._count.estudantes })),
      };
    }, escolaId);
  }

  /**
   * O "Painel da Sala em Tempo Real" — POR COMPUTADOR quando a turma montou
   * equipes, por criança quando não. **Só progresso e alerta por linha**
   * (`regras/painel.ts#PROIBIDO_NA_LINHA_DO_PAINEL`): nem a escolha, nem acerto,
   * nem nível. As escolhas da Etapa 2 e os alertas vivem no RESUMO, anônimo.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const { gate, pacote } = await this.exigirPacote(tx, escolaId, turmaId);
      const [estudantes, mapa, computadores] = await Promise.all([
        tx.user.findMany({
          where: { escolaId, turmaId, role: "estudante" },
          select: {
            id: true,
            displayName: true,
            username: true,
            ninaSessoes: { where: { escolaId, pacoteId: gate.pacoteId, rodada: gate.rodada }, take: 1 },
          },
          orderBy: { displayName: "asc" },
        }),
        mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, gate.pacoteId),
        computadoresDaMontagem(tx, escolaId, turmaId, EXP_ID, gate.pacoteId),
      ]);

      const linhas = estudantes.map((e) => {
        const s = e.ninaSessoes[0] ?? null;
        const gravado = s ? normalizarPasso(s.passo) : PASSO_INICIAL;
        const passo = passoEfetivo(gravado, gate.etapa);
        return {
          estudanteId: e.id,
          nome: e.displayName,
          usuario: e.username,
          entrou: s !== null,
          passo,
          etapaVisivel: ETAPA_VISIVEL_DO_PASSO[passo],
          aguardando: s !== null && aguardandoOProfessor(gravado, gate.etapa),
          concluiu: Boolean(s?.concluidaEm),
          alertas: s
            ? alertasDaLinha({
                rotinaTentativas: s.rotinaTentativas,
                rotinaValida: s.rotinaValida,
                carimbosE4: carimbosDaLinha(s.carimbosE4, "e4"),
                carimbosE6: carimbosDaLinha(s.carimbosE6, "e6"),
              })
            : { semParada: false, uniformes: false },
          _sessao: s,
          /* O representante do computador é o mais ADIANTADO; entre iguais, o mais recente. */
          _peso: s ? ordemDoPasso(gravado) * 1e13 + s.atualizadoEm.getTime() : 0,
        };
      });
      const unidades = colapsarEmUnidades(
        linhas,
        (l) => l.estudanteId,
        mapa,
        (l) => l.entrou,
        (l) => l._peso,
      );

      const previsoes: Suporte[][] = [];
      const saida = unidades.map(({ linha, equipe }) => {
        const { _sessao: s, _peso: _p, ...resto } = linha;
        if (s?.previsaoTravadaEm) previsoes.push(suportesDaLinha(s.previsaoItens));
        return { ...resto, equipe: equipe ? { id: equipe.id, nome: equipe.nome } : null };
      });
      const entraram = saida.filter((u) => u.entrou);
      const porEtapa = contagemPorEtapaVisivel(entraram.map((u) => u.passo));

      return {
        turma,
        pacote: {
          id: pacote.id,
          disciplina: pacote.disciplina,
          tema: pacote.tema,
          origem: pacote.origem,
          midia: resumoDaMidia(pacote.midia),
        },
        rodada: gate.rodada,
        etapa: gate.etapa,
        pausada: gate.pausada,
        proximaEtapa: proximaEtapa(gate.etapa),
        linhas: saida,
        resumo: {
          total: computadores ?? saida.length,
          entraram: entraram.length,
          concluiram: saida.filter((u) => u.concluiu).length,
          porComputador: mapa.size > 0,
          porEtapa: {
            "1": porEtapa[1],
            "2": porEtapa[2],
            "3": porEtapa[3],
            "4": porEtapa[4],
            "5": porEtapa[5],
            "6": porEtapa[6],
          },
          escolhas: distribuicaoDasEscolhas(previsoes),
          alertas: {
            semParada: saida.filter((u) => u.alertas.semParada).length,
            uniformes: saida.filter((u) => u.alertas.uniformes).length,
          },
        },
      };
    }, escolaId);
  }

  /**
   * Os botões da professora: "Liberar Filtro" / "Liberar Inspeção" (só avança,
   * uma por vez; a mesma é no-op), "Pausar Turma" e "Retomar Turma". Lock
   * EXCLUSIVO da turma — espera as jogadas em voo. Cada clique que muda algo
   * grava uma linha em `exp03ef1b_gates_historico`.
   */
  async mudarGate(escolaId: string, turmaId: string, professorId: string | undefined, atorId: string, pedido: PedidoDoGate) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirPacote(tx, escolaId, turmaId);
      const r = transicaoDoGate({ etapa: gate.etapa, pausada: gate.pausada }, pedido);
      if (!r.ok) throw erroDeJogo(r.codigo, { etapaAtual: gate.etapa, proximaEtapa: proximaEtapa(gate.etapa) });

      let atualizadoEm = gate.atualizadoEm;
      if (r.mudou) {
        const agora = new Date();
        const data: Prisma.Exp03ef1bGateTurmaUpdateInput =
          pedido.acao === "liberar"
            ? r.estado.etapa === "filtro"
              ? { etapa: "filtro", filtroLiberadoEm: agora }
              : { etapa: "inspecao", inspecaoLiberadaEm: agora }
            : { pausada: r.estado.pausada, pausadaEm: r.estado.pausada ? agora : null };
        const linha = await tx.exp03ef1bGateTurma.update({
          where: { escolaId_turmaId: { escolaId, turmaId } },
          data,
          select: { atualizadoEm: true },
        });
        await tx.exp03ef1bGateHistorico.create({
          data: {
            escolaId,
            turmaId,
            pacoteId: gate.pacoteId,
            rodada: gate.rodada,
            acao: pedido.acao,
            etapa: r.estado.etapa,
            professorId: atorId,
            em: agora,
          },
        });
        atualizadoEm = linha.atualizadoEm;
      }
      return {
        turma,
        pacoteId: gate.pacoteId,
        rodada: gate.rodada,
        etapa: r.estado.etapa,
        pausada: r.estado.pausada,
        proximaEtapa: proximaEtapa(r.estado.etapa),
        mudou: r.mudou,
        atualizadoEm: atualizadoEm.toISOString(),
      };
    }, escolaId);
  }

  /**
   * "Zerar Turma" — sobe a rodada, volta à etapa da escolha e despausa, e
   * APAGA a evidência pedagógica da atividade, de todas as rodadas (ADR-155).
   * As sessões da rodada anterior ficam.
   */
  async zerar(escolaId: string, turmaId: string, professorId: string | undefined, atorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const { gate } = await this.exigirPacote(tx, escolaId, turmaId);
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: gate.pacoteId });
      const rodada = gate.rodada + 1;
      await tx.exp03ef1bGateTurma.update({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        data: {
          rodada,
          etapa: ETAPA_INICIAL,
          pausada: false,
          pausadaEm: null,
          filtroLiberadoEm: null,
          inspecaoLiberadaEm: null,
        },
      });
      await tx.exp03ef1bGateHistorico.create({
        data: { escolaId, turmaId, pacoteId: gate.pacoteId, rodada, acao: "zerar", etapa: ETAPA_INICIAL, professorId: atorId },
      });
      return { pacoteId: gate.pacoteId, rodada, etapa: ETAPA_INICIAL };
    }, escolaId);
  }

  /** O guia da aula: o esqueleto COM gabarito, o roteiro de mediação e os gatilhos. */
  async material(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const gate = await tx.exp03ef1bGateTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        include: { pacote: { select: SELECAO_DO_PACOTE } },
      });
      const pacote = gate ? pacoteDaLinha(gate.pacote) : null;
      return {
        pacote: pacote ? { tema: pacote.conteudo.tema, reportagens: pacote.conteudo.reportagens } : null,
        cartoes: CARTOES_DA_MISSAO.map((c) => ({ id: c.id, figura: c.figura, pergunta: c.pergunta, certo: c.certo })),
        rotina: { sequencia: SEQUENCIA_CERTA.map((bloco) => ({ bloco, rotulo: ROTULO_DO_BLOCO[bloco] })) },
        fichasTeste: FICHAS_TESTE.map((f) => ({ manchete: f.manchete, ficha: f.ficha })),
        reparo: {
          regra:
            "A ficha do telão está corrigida quando a etiqueta Pátio vai para o campo Onde. Onde a criança põe as etiquetas estudantes e sexta fica registrado, mas não conta.",
        },
        mediacao: ROTEIRO_DE_MEDIACAO.map((m) => ({ ...m })),
        gatilhos: [...GATILHOS_DE_CONDUCAO],
      };
    }, escolaId);
  }

  /** As ATIVIDADES da turma (ADR-130): a em andamento, inteira, e a lista de todas. */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const emAndamento = await tx.exp03ef1bGateTurma.findUnique({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        include: { pacote: { select: SELECAO_DO_PACOTE } },
      });
      const [todos, rodadas] = await Promise.all([
        tx.exp03ef1bPacote.findMany({
          where: { escolaId, turmaId },
          select: { id: true, disciplina: true, tema: true, origem: true, ativo: true, criadoEm: true, imagensAprovadasEm: true },
          orderBy: { criadoEm: "desc" },
        }),
        tx.exp03ef1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.pacoteId, r._max.rodada ?? 0]));
      return {
        ativo: emAndamento
          ? {
              ...this.pacoteParaATela(pacoteDaLinha(emAndamento.pacote)),
              rodada: emAndamento.rodada,
              etapa: normalizarEtapa(emAndamento.etapa),
            }
          : null,
        historico: todos.map((p) => ({
          id: p.id,
          disciplina: ehDisciplina(p.disciplina) ? p.disciplina : ("projeto-interdisciplinar" as const),
          tema: p.tema,
          origem: ehOrigem(p.origem) ? p.origem : ("ia" as const),
          ativo: p.ativo,
          criadoEm: p.criadoEm.toISOString(),
          rodadas: maiorRodada.get(p.id) ?? 0,
          imagensAprovadas: p.imagensAprovadasEm !== null,
        })),
      };
    }, escolaId);
  }

  /** UMA atividade, inteira — em andamento ou pronta. */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const [gate, rodadas] = await Promise.all([
        this.lerGate(tx, escolaId, turmaId),
        tx.exp03ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } }),
      ]);
      const emAndamento = gate?.pacoteId === pacoteId;
      return {
        ...this.pacoteParaATela(pacoteDaLinha(linha)),
        ativo: emAndamento,
        rodada: emAndamento && gate ? gate.rodada : null,
        etapa: emAndamento && gate ? gate.etapa : null,
        criadoEm: linha.criadoEm.toISOString(),
        rodadas: rodadas._max.rodada ?? 0,
        imagensAprovadasEm: linha.imagensAprovadasEm?.toISOString() ?? null,
      };
    }, escolaId);
  }

  /**
   * A SEGUNDA FASE da aprovação (ADR-146): a professora viu as imagens — e
   * conferiu o pátio na do telão. Depois disto a atividade pode ir ao ar e as
   * imagens não mudam mais. Idempotente.
   */
  async aprovarImagens(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      const carimbo =
        linha.imagensAprovadasEm ??
        (
          await tx.exp03ef1bPacote.update({
            where: { id: linha.id },
            data: { imagensAprovadasEm: new Date() },
            select: { imagensAprovadasEm: true },
          })
        ).imagensAprovadasEm;
      return { pacoteId: linha.id, imagensAprovadasEm: (carimbo ?? new Date()).toISOString() };
    }, escolaId);
  }

  /**
   * "Liberar Atividade para a Turma" (ADR-130): o escolhido vira a atividade
   * EM ANDAMENTO, o que estava volta a ser pronto, e o gate aponta o escolhido
   * na etapa da escolha, despausado. O pacote que já rodou abre a rodada
   * SEGUINTE à última. Idempotente.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const escolhido = await this.pacoteDaTurma(tx, escolaId, turmaId, pacoteId);
      if (!escolhido.imagensAprovadasEm) throw erroDeJogo("imagens-nao-aprovadas");

      const atual = await this.lerGate(tx, escolaId, turmaId);
      if (atual?.pacoteId === pacoteId) return { pacoteId, rodada: atual.rodada, etapa: atual.etapa, mudou: false };

      const ultima = await tx.exp03ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      const rodada = (ultima._max.rodada ?? 0) + 1;
      await tx.exp03ef1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
      await tx.exp03ef1bPacote.updateMany({ where: { id: pacoteId, escolaId }, data: { ativo: true } });
      const gate = {
        pacoteId,
        rodada,
        etapa: ETAPA_INICIAL,
        pausada: false,
        pausadaEm: null,
        filtroLiberadoEm: null,
        inspecaoLiberadaEm: null,
      };
      await tx.exp03ef1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, ...gate },
        update: gate,
      });
      return { pacoteId, rodada, etapa: ETAPA_INICIAL, mudou: true };
    }, escolaId);
  }

  /**
   * "Homologar Pacote" — a PRIMEIRA fase (os textos). Grava o pacote como a
   * professora o deixou, numa atividade PRONTA (não no ar), com
   * `imagens_aprovadas_em` nulo. O mesmo conteúdo do pacote mais recente é o
   * segundo clique (idempotente). O conteúdo IGUAL ao banco padrão vira
   * `origem = 'padrao'` e leva as imagens do banco; o da IA leva só as cenas
   * fixas (o caso novo e o Desafio Extra).
   */
  async homologar(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    criadoPor: string,
    corpo: {
      parametros: { disciplina: Disciplina; tema: string; assuntos: string; contexto?: string };
      conteudo: ConteudoDoPacote;
      /** Aceito pelo contrato (`HomologacaoSchema`) e não gravado: a missão não tem a telemetria docente do Júri. */
      preparoIniciadoEm?: string;
    },
    imagensDoBanco: Readonly<Record<string, string>> = {},
  ) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      /* A estrutura é do servidor: escrita de novo por cima do que a tela mandou. */
      const conteudo = aplicarEstrutura(corpo.conteudo);
      const origem: OrigemDoPacote = canonico(conteudo) === canonico(conteudoDoBancoPadrao()) ? "padrao" : "ia";
      const parametros = PARAMETROS_ATUAIS(corpo.parametros);

      const ultimo = await tx.exp03ef1bPacote.findFirst({
        where: { escolaId, turmaId },
        orderBy: { criadoEm: "desc" },
        select: { id: true, tema: true, ativo: true, origem: true, disciplina: true, assuntos: true, contexto: true, conteudo: true },
      });
      if (
        ultimo &&
        ultimo.disciplina === parametros.disciplina &&
        ultimo.assuntos === parametros.assuntos &&
        ultimo.contexto === parametros.contexto &&
        canonico(ultimo.conteudo) === canonico(conteudo)
      ) {
        return {
          id: ultimo.id,
          disciplina: parametros.disciplina,
          tema: ultimo.tema,
          origem: ehOrigem(ultimo.origem) ? ultimo.origem : origem,
          ativo: ultimo.ativo,
        };
      }

      const agora = new Date();
      const novo = await tx.exp03ef1bPacote.create({
        data: {
          escolaId,
          turmaId,
          origem,
          disciplina: parametros.disciplina,
          tema: conteudo.tema,
          assuntos: parametros.assuntos,
          contexto: parametros.contexto,
          conteudo: conteudo as unknown as Prisma.InputJsonValue,
          midia: imagensDoBancoPara(origem, imagensDoBanco),
          ativo: false,
          criadoPor,
          aprovadoEm: agora,
        },
        select: { id: true, tema: true },
      });
      return { id: novo.id, disciplina: parametros.disciplina, tema: novo.tema, origem, ativo: false };
    }, escolaId);
  }

  /**
   * "Usar Banco Padrão" (E0-PROF-02) — o caminho curto: sem IA e sem
   * curadoria. Cria (ou reaproveita) o pacote `padrao` da Feira de Troca de
   * Livros, já com as imagens APROVADAS (as do banco, geradas pelo `admin`), e
   * com `porNoAr` o põe em andamento. A imagem que o banco ainda não tem segue
   * com a ilustração local da experiência.
   */
  async usarBancoPadrao(
    escolaId: string,
    turmaId: string,
    professorId: string | undefined,
    criadoPor: string,
    porNoAr: boolean,
    imagensDoBanco: Readonly<Record<string, string>> = {},
  ) {
    const pacote = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId, "exclusivo");
      const conteudo = conteudoDoBancoPadrao();
      const existentes = await tx.exp03ef1bPacote.findMany({
        where: { escolaId, turmaId, origem: "padrao" },
        orderBy: { criadoEm: "desc" },
        select: { id: true, tema: true, ativo: true, conteudo: true, midia: true },
      });
      const igual = existentes.find((p) => canonico(p.conteudo) === canonico(conteudo));
      const doBanco = imagensDoBancoPara("padrao", imagensDoBanco);
      if (igual) {
        const midia = midiaDaLinha(igual.midia);
        const faltavam = Object.fromEntries(Object.entries(doBanco).filter(([chave]) => !midia[chave as ChaveDaMidia]));
        /* No ar, as imagens não mudam no meio da aula. */
        if (!igual.ativo && Object.keys(faltavam).length > 0) {
          await tx.exp03ef1bPacote.update({ where: { id: igual.id }, data: { midia: { ...midia, ...faltavam } } });
        }
        return { id: igual.id, tema: igual.tema, ativo: igual.ativo };
      }
      const agora = new Date();
      return tx.exp03ef1bPacote.create({
        data: {
          escolaId,
          turmaId,
          origem: "padrao",
          disciplina: DISCIPLINA_DO_BANCO_PADRAO,
          tema: conteudo.tema,
          assuntos: ASSUNTOS_DO_BANCO_PADRAO,
          contexto: null,
          conteudo: conteudo as unknown as Prisma.InputJsonValue,
          midia: doBanco,
          imagensAprovadasEm: agora,
          ativo: false,
          criadoPor,
          aprovadoEm: agora,
        },
        select: { id: true, tema: true, ativo: true },
      });
    }, escolaId);
    const emAndamento = porNoAr ? await this.colocarEmAndamento(escolaId, turmaId, professorId, pacote.id) : null;
    return {
      id: pacote.id,
      disciplina: DISCIPLINA_DO_BANCO_PADRAO,
      tema: pacote.tema,
      origem: "padrao" as const,
      ativo: emAndamento ? true : pacote.ativo,
    };
  }

  /** A guarda de turma, sozinha — a do preparo, ANTES de gastar token. */
  async exigirTurmaVisivel(escolaId: string, turmaId: string, professorId?: string): Promise<void> {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
  }

  /**
   * Uma geração de rascunho que chamou a IA, e o que custou. O rascunho não
   * persiste: a conta vai no pacote em sala (sem pacote em andamento, não há
   * onde contar). Nunca derruba o rascunho.
   */
  async registrarGeracao(escolaId: string, turmaId: string, tokens: number): Promise<void> {
    try {
      await this.prisma.comTenancy(async (tx) => {
        const gate = await this.lerGate(tx, escolaId, turmaId);
        if (!gate) return;
        await tx.exp03ef1bPacote.updateMany({
          where: { id: gate.pacoteId, escolaId },
          data: { iaGeracoes: { increment: 1 }, iaTokens: { increment: Math.max(0, Math.round(tokens)) } },
        });
      }, escolaId);
    } catch {
      logger.warn({ codigo: "exp03ef1b-geracao-nao-contada", escolaId }, "geração do preparo não contada");
    }
  }

  /**
   * O pacote das imagens (`midia.service.ts`): o pedido, ou o em andamento sem
   * pedido. Só enquanto as imagens estão EM VALIDAÇÃO: depois de aprovadas, 409
   * `imagens-ja-aprovadas`.
   */
  async pacoteParaMidia(escolaId: string, turmaId: string, professorId?: string, pacoteId?: string): Promise<PacoteLido> {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const id = pacoteId ?? (await this.exigirPacote(tx, escolaId, turmaId)).pacote.id;
      const linha = await this.pacoteDaTurma(tx, escolaId, turmaId, id);
      if (linha.imagensAprovadasEm) throw erroDeJogo("imagens-ja-aprovadas");
      return pacoteDaLinha(linha);
    }, escolaId);
  }

  /** Grava a URL de UMA imagem, por concatenação de JSONB no próprio UPDATE (duas abas não se apagam). */
  async registrarMidia(escolaId: string, pacoteId: string, chave: ChaveDaMidia, url: string): Promise<void> {
    await this.prisma.comTenancy(
      (tx) => tx.$executeRaw`
        UPDATE exp03ef1b_pacotes
           SET midia = midia || jsonb_build_object(${chave}::text, ${url}::text),
               atualizado_em = now()
         WHERE id = ${pacoteId}::uuid AND escola_id = ${escolaId}`,
      escolaId,
    );
  }

  // ────────────────────────────────────────────────────────────── privados

  /**
   * O esqueleto de TODA jogada: o funil (`garantirSessao`), o lock
   * compartilhado da turma com o gate relido e a pausa — nada se grava com a
   * turma pausada.
   */
  private async jogar<T>(
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
    fazer: (tx: Prisma.TransactionClient, ctx: ContextoDoEstudante, gate: GateLido) => Promise<T>,
  ): Promise<T> {
    return this.prisma.comTenancy(async (tx) => {
      const ctx = await this.garantirSessao(tx, escolaId, estudanteId, turmaId);
      const gate = await this.gateDaSessao(tx, escolaId, ctx);
      if (gate.pausada) throw erroDeJogo("turma-pausada");
      return fazer(tx, ctx, gate);
    }, escolaId);
  }

  /** A jogada do passo `esperado` vale agora? (`regras/passos.ts#podeAgir`.) */
  private exigirPasso(s: Exp03ef1bSessao, gate: GateLido, esperado: Passo): void {
    const r = podeAgir(normalizarPasso(s.passo), { etapa: gate.etapa, pausada: gate.pausada }, esperado);
    if (!r.ok) throw erroDeJogo(r.codigo as CodigoErro);
  }

  private reler(tx: Prisma.TransactionClient, id: string) {
    return tx.exp03ef1bSessao.findUniqueOrThrow({ where: { id } });
  }

  /** O estado curto que toda jogada devolve (`EstadoSchema`). */
  private estado(s: Exp03ef1bSessao, gate: GateLido) {
    const passo = normalizarPasso(s.passo);
    return {
      passo: passoEfetivo(passo, gate.etapa),
      etapa: gate.etapa,
      pausada: gate.pausada,
      aguardandoOProfessor: aguardandoOProfessor(passo, gate.etapa),
    };
  }

  /** A ficha do TELÃO (Onde vazio) e o id dele nesta sessão. */
  private fichaDoTelao(s: Exp03ef1bSessao, conteudo: ConteudoDoPacote): { reportagemId: string; ficha: Ficha } {
    const telao = conteudo.reportagens.find((r) => r.suporte === SUPORTE_OMITIDO);
    const [reportagemId] = idsDosSuportes(semente(s), [SUPORTE_OMITIDO]);
    return { reportagemId: reportagemId ?? "", ficha: { ...(telao?.ficha ?? { quem: null, onde: null, quando: null }) } };
  }

  /** A sessão inteira (`SessaoSchema`): cada bloco só do passo EFETIVO dele em diante. */
  private sessaoPublica(ctx: ContextoDoEstudante) {
    const { sessao: s, gate, pacote } = ctx;
    const gravado = normalizarPasso(s.passo);
    const efetivo = passoEfetivo(gravado, gate.etapa);
    const desde = (piso: Passo) => passoNoMinimo(efetivo, piso);
    const seed = semente(s);
    const url = (chave: ChaveDaMidia) => pacote.midia[chave] ?? null;
    const reportagens = reportagensDaSessao(seed);
    const idDe = new Map(reportagens.map((r) => [r.suporte, r.id]));
    const posicoes = posicoesDaLinha(s.reparoPosicoes);
    const etiquetas = etiquetasDaSessao(seed);
    const idDaEtiqueta = new Map(etiquetas.map((e) => [e.etiqueta, e.id]));

    return {
      ...this.estado(s, gate),
      pacoteId: s.pacoteId,
      rodada: s.rodada,
      passoDoEstudante: gravado,
      jornal: {
        tema: pacote.conteudo.tema,
        cartaz: { texto: pacote.conteudo.cartaz.texto, imagem: { url: url("cartaz"), alt: pacote.conteudo.cartaz.imagem.alt } },
        reportagens: pacote.conteudo.reportagens.map((r) => ({
          id: idDe.get(r.suporte) ?? "",
          suporte: r.suporte,
          kicker: ROTULO_DO_SUPORTE[r.suporte],
          manchete: r.manchete,
          legenda: r.legenda,
          lugar: ROTULO_DO_LUGAR_DO_EVENTO,
          imagem: { url: url(r.suporte), alt: r.imagem.alt },
        })),
      },
      selos: idsDosSuportes(seed, suportesDaLinha(s.selosFeira)),
      previsao: { itens: idsDosSuportes(seed, suportesDaLinha(s.previsaoItens)), travada: s.previsaoTravadaEm !== null },
      filtro: desde("omissao")
        ? { encontradas: idsDosSuportes(seed, buscar(pacote.conteudo.reportagens, "onde", LUGAR_DO_EVENTO)) }
        : null,
      ficha: desde("ficha") ? { ...this.fichaDoTelao(s, pacote.conteudo), aberta: s.fichaAbertaEm !== null } : null,
      carimbos: { e4: carimbosDaLinha(s.carimbosE4, "e4"), e6: carimbosDaLinha(s.carimbosE6, "e6") },
      reparo: desde("reparo")
        ? {
            etiquetas: etiquetas.map((e) => ({ id: e.id, etiqueta: e.etiqueta, rotulo: ROTULO_DO_VALOR[e.etiqueta] })),
            enviada: posicoes
              ? {
                  quem: idDaEtiqueta.get(posicoes.quem) ?? "",
                  onde: idDaEtiqueta.get(posicoes.onde) ?? "",
                  quando: idDaEtiqueta.get(posicoes.quando) ?? "",
                }
              : null,
            desfecho: s.reparoValido === null ? null : s.reparoValido ? ("sucesso" as const) : ("erro" as const),
          }
        : null,
      rotina: desde("rotina")
        ? {
            blocos: bandejaDaSessao(seed).map((b) => ({ id: b.id, bloco: b.bloco, rotulo: ROTULO_DO_BLOCO[b.bloco] })),
            valida: s.rotinaValida,
            simulacao: s.rotinaValida ? simularRotina() : null,
          }
        : null,
      caso: desde("caso")
        ? {
            tema: TEMA_DO_CASO,
            materias: MATERIAS_DO_CASO.map((m) => ({
              id: m.id,
              titulo: m.titulo,
              ficha: { ...m.ficha },
              imagem: { url: url(m.chave), alt: m.imagem.alt },
            })),
            ferramentas: FERRAMENTAS.map((f) => ({ ...f })),
          }
        : null,
      fim:
        efetivo === "fim"
          ? {
              resumo: resumoDaSessao(s, pacote.conteudo),
              desafioExtra: DESAFIO_EXTRA.map((d) => ({
                manchete: d.manchete,
                ficha: { ...d.ficha },
                imagem: { url: url(d.chave), alt: d.imagem.alt },
              })),
            }
          : null,
      concluida: s.concluidaEm !== null,
    };
  }

  /** O pacote como as telas da professora o mostram (só as imagens do pacote). */
  private pacoteParaATela(pacote: PacoteLido) {
    return {
      id: pacote.id,
      disciplina: pacote.disciplina,
      tema: pacote.tema,
      origem: pacote.origem,
      assuntos: pacote.assuntos,
      conteudo: pacote.conteudo,
      midia: resumoDaMidia(pacote.midia),
      imagens: imagensDoPacote(pacote.midia),
    };
  }

  /** O pacote desta turma, ou 404 — o de outra turma não tem a existência confirmada. */
  private async pacoteDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp03ef1bPacote.findFirst({
          where: { id: pacoteId, escolaId, turmaId },
          select: { ...SELECAO_DO_PACOTE, criadoEm: true, imagensAprovadasEm: true },
        })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  /**
   * A MARCA de uma ação na ficha, DENTRO da transação da jogada: cai junto se
   * ela cair. A cópia para os colegas de computador é da própria porta
   * `marcar` (E14). Toda rodada mede de novo (ADR-145). `null` = sem marca.
   */
  private async marcar(
    tx: Prisma.TransactionClient,
    ctx: ContextoDoEstudante,
    gate: GateLido,
    marcador: string,
    status: Nivel | null,
  ): Promise<void> {
    if (status === null) return;
    await this.evidencias.marcar(tx, {
      escolaId: ctx.pacote.escolaId,
      expId: EXP_ID,
      atividadeId: gate.pacoteId,
      rodada: gate.rodada,
      estudanteId: ctx.sessao.estudanteId,
      marcador,
      turmaId: ctx.turmaId,
      status,
    });
  }

  /**
   * O lock COMPARTILHADO da turma e a releitura do gate — depois do lock, e é a
   * leitura que vale (a pausa e a etapa também). O zerar, a troca de atividade e
   * os botões pegam o EXCLUSIVO: a jogada que chega depois vê a rodada nova
   * (409 `rodada-mudou`, e a tela recarrega).
   */
  private async gateDaSessao(tx: Prisma.TransactionClient, escolaId: string, ctx: ContextoDoEstudante): Promise<GateLido> {
    await this.travarTurma(tx, escolaId, ctx.turmaId, "compartilhado");
    const gate = await this.lerGate(tx, escolaId, ctx.turmaId);
    if (!gate || gate.pacoteId !== ctx.sessao.pacoteId || gate.rodada !== ctx.sessao.rodada) {
      throw erroDeJogo("rodada-mudou");
    }
    return gate;
  }

  private async lerGate(tx: Prisma.TransactionClient, escolaId: string, turmaId: string): Promise<GateLido | null> {
    const linha = await tx.exp03ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      select: { pacoteId: true, rodada: true, etapa: true, pausada: true, atualizadoEm: true },
    });
    return linha
      ? {
          pacoteId: linha.pacoteId,
          rodada: linha.rodada,
          etapa: normalizarEtapa(linha.etapa),
          pausada: linha.pausada,
          atualizadoEm: linha.atualizadoEm,
        }
      : null;
  }

  /** O gate e o pacote EM ANDAMENTO — ou 403 `atividade-nao-preparada` (a plataforma não cria atividade, ADR-130). */
  private async exigirPacote(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
  ): Promise<{ gate: GateLido; pacote: PacoteLido }> {
    const linha = await tx.exp03ef1bGateTurma.findUnique({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      include: { pacote: { select: SELECAO_DO_PACOTE } },
    });
    if (!linha) throw erroDeJogo("atividade-nao-preparada");
    return {
      gate: {
        pacoteId: linha.pacoteId,
        rodada: linha.rodada,
        etapa: normalizarEtapa(linha.etapa),
        pausada: linha.pausada,
        atualizadoEm: linha.atualizadoEm,
      },
      pacote: pacoteDaLinha(linha.pacote),
    };
  }

  /**
   * O FUNIL de toda rota de estudante que lê ou escreve a sessão: escola do
   * token, missão disponível (ADR-87) e liberada na turma (ADR-69), turma, gate
   * e a sessão desta rodada — criada se faltar, e travada por estudante (o
   * lock vem ANTES da leitura: duas abas não leem o mesmo estado).
   */
  private async garantirSessao(
    tx: Prisma.TransactionClient,
    escolaId: string,
    estudanteId: string,
    turmaId: string | null,
  ): Promise<ContextoDoEstudante> {
    await this.estudanteDaEscola(tx, escolaId, estudanteId);
    if (!turmaId) throw erroDeJogo("sem-turma");
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true } });
    if (!turma) throw erroDeJogo("turma-nao-encontrada");

    const { gate, pacote } = await this.exigirPacote(tx, escolaId, turmaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`nina-noticia:estudante:${escolaId}:${estudanteId}`}, 0))`;
    const chave = { pacoteId: gate.pacoteId, rodada: gate.rodada, estudanteId };
    /* INSERT ... ON CONFLICT DO NOTHING: o F5 e a segunda aba não abortam a transação. */
    await tx.exp03ef1bSessao.createMany({
      data: [{ ...chave, escolaId, turmaId, versaoInstrumento: VERSAO_DO_INSTRUMENTO }],
      skipDuplicates: true,
    });
    const sessao = await tx.exp03ef1bSessao.findUniqueOrThrow({ where: { pacoteId_rodada_estudanteId: chave, escolaId } });
    return { turmaId, gate, pacote, sessao };
  }

  /** `users` está fora da RLS: a escola do token precisa bater com a do usuário. Depois, a porta da sala. */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
  }

  /** Escola do token E matrícula na turma quando quem pede é professor. 404, nunca 403. */
  private async turmaVisivel(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true, nome: true, serie: true } });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) throw erroDeJogo("turma-nao-encontrada");
    return turma;
  }

  /** O lock consultivo da TURMA: exclusivo para quem muda a aula inteira; compartilhado para as jogadas. */
  private async travarTurma(
    tx: Prisma.TransactionClient,
    escolaId: string,
    turmaId: string,
    modo: "exclusivo" | "compartilhado",
  ): Promise<void> {
    const chave = `nina-noticia:turma:${escolaId}:${turmaId}`;
    if (modo === "exclusivo") await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${chave}, 0))`;
    else await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${chave}, 0))`;
  }
}
