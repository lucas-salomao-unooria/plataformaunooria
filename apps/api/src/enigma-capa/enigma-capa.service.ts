import { Injectable } from "@nestjs/common";
import { Prisma, type Exp02ef1bPacote, type Exp02ef1bSessao } from "@prisma/client";
import type { z } from "zod";
import type { Perfil } from "../auth/claims";
import { exigirMissaoLiberada } from "../comum/liberacao";
import { ondeAsTurmasSaoVisiveis, professorLeciona } from "../comum/turmas-do-professor";
import { mapaDeEquipes } from "../equipes/consulta";
import { colapsarEmUnidades, type EquipeDoMapa } from "../equipes/regras";
import { apagarEvidenciaDaAtividade } from "../evidencias/apagar-da-atividade";
import { EvidenciasService } from "../evidencias/evidencias.service";
import { FICHA_EXP02EF1B } from "../evidencias/fichas/exp02ef1b";
import { ehUuid } from "../motor/guardas";
import { logger } from "../observabilidade/logger";
import { PrismaService } from "../prisma/prisma.service";
import {
  CARTAS_DOS_PARES,
  CHAVES_PRONTAS,
  DISCIPLINAS,
  ELEMENTOS_DA_SEGUNDA_FOTO,
  EXP_ID,
  FAIXA_COMUM,
  FOTOS,
  MOLDURA_DA_CAPA,
  MOLDURA_DA_SEGUNDA_FOTO,
  MOTIVOS_DO_PAR,
  PACOTES_PRONTOS,
  PISO_DA_LUPA_MS,
  PRONTO_DA_DISCIPLINA,
  PROPORCAO_DA_PANORAMICA,
  PROPORCAO_DA_SEGUNDA_FOTO,
  RAIO_PADRAO,
  RECORTE_DA_FOTO,
  ROTEIRO,
  ROTULO_DA_DISCIPLINA,
  ROTULO_DO_ELEMENTO,
  ROTULO_DO_MOTIVO,
  SEGUNDA_FOTO,
  TEMPOS,
  TEXTOS,
  TOQUES_FORA_MAX,
  VERSAO_DO_INSTRUMENTO,
  conteudoPronto,
  fraseDaMissao,
  fraseDoFora,
  type ChaveDeCena,
  type ChavePronta,
  type ConteudoDoPacote,
  type Deslocamento,
  type Disciplina,
  type ElementoDaSegundaFoto,
  type Fase,
  type FotoId,
  type MotivoDoPar,
  type Origem,
  type Ponto,
  type SeloId,
} from "./conteudo";
import {
  ConteudoBaseSchema,
  type AlvosDoRascunhoSchema,
  type EstadoSchema,
  type GerarSchema,
  type HomologarSchema,
  type LinhaDoPainelSchema,
} from "./contrato-de-rotas";
import { erroDeJogo } from "./erros";
import { PreparoDaExp02ef1bService, type MotivoDoPronto } from "./preparo.service";
import {
  MARCADOR_CO01,
  MARCADOR_CO05,
  grauDaLupa,
  grauDoFora,
  grauDoSelo,
  grauDosInvariantes,
  nivelCO01,
  nivelCO05,
} from "./regras/evidencia";
import { arredondar, essencialVisivelNaSegunda, falaDaVisitante, itensFora, marcaveisFora, retanguloVisivel } from "./regras/geometria";
import { completa, lerAchados, tocar, type BuscaDaSessao } from "./regras/invariantes";
import { acumularLupa, pisoCumprido, type RelatoDaLupa } from "./regras/lupa";
import { problemasDoConteudo } from "./regras/pacote";
import { parCorreto } from "./regras/pares";
import { FASE_INICIAL, avancarFase, normalizarFase, passoEfetivo, type MarcosDaSessao } from "./regras/passos";

/**
 * Persistência e regras aplicadas da exp02ef1b — O Enigma da Capa da Rádio
 * (ADR-184; a revisão 2.0.0, ADR-186).
 *
 * Molde: `efeito-amplificador` (o funil, os locks, o pacote como atividade e a
 * rodada como reaplicação, o gate da turma com histórico, o preparo com IA e
 * o banco padrão). Toda query leva `escola_id` no `where` ALÉM da RLS que o
 * `comTenancy` arma (regra 1, defesa em profundidade).
 *
 * **O gabarito não desce** (regra 3): a cena vai ao estudante sem o núcleo,
 * a fala da visitante, a coerência do selo, os alvos e os marcáveis; quem diz
 * o que um gesto mediu é este serviço, e as marcas entram na transação do
 * gesto (a EF02CO01 quando os invariantes completam, a EF02CO05 no "Pronto"
 * do "o que ficou fora"). A exceção, registrada na ADR-186: os dois alvos
 * descem em `lupa.alvos` enquanto o passo é `lupa`, para o brilho da lente.
 *
 * **Sem IA na aula**: a única IA é a do preparo do professor
 * (`preparo.service.ts`).
 */

interface PacoteDaTurma {
  id: string;
  turmaId: string;
  tema: string;
  conteudo: ConteudoDoPacote;
  rodada: number;
}

interface ContextoDaTurma {
  turmaId: string | null;
  pacote: PacoteDaTurma | null;
  fase: Fase | null;
}

type Sessao = Exp02ef1bSessao;
type Estado = z.infer<typeof EstadoSchema>;

function marcosDe(s: Sessao | null | undefined): MarcosDaSessao | null {
  if (!s) return null;
  return {
    lupaLiberada: s.lupaLiberadaEm !== null,
    publicou: s.capaPublicadaEm !== null,
    invariantesCompletos: s.invariantesConcluidoEm !== null,
    panoramicaAberta: s.panoramicaAbertaEm !== null,
    marcouFora: s.foraEm !== null,
    formouPar: s.parEm !== null,
    /* A segunda foto conclui (a 2.0.0 grava `concluido_em` junto com `segunda_em`). */
    concluiu: s.segundaEm !== null || s.concluidoEm !== null,
  };
}

/** O conteúdo do `Json` da linha, ou `null` se a forma não bate (linha de outra versão). */
function lerConteudo(bruto: Prisma.JsonValue): ConteudoDoPacote | null {
  const lido = ConteudoBaseSchema.safeParse(bruto);
  return lido.success ? (lido.data as ConteudoDoPacote) : null;
}

function lerDeslocamento(bruto: Prisma.JsonValue | null): Deslocamento {
  const o = (bruto ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
  return { x: n(o.x), y: n(o.y) };
}

function lerPontos(bruto: Prisma.JsonValue | null): Ponto[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((p) => {
    const o = (p ?? {}) as Record<string, unknown>;
    return typeof o.x === "number" && typeof o.y === "number" ? [{ x: o.x, y: o.y }] : [];
  });
}

function buscaDe(s: Sessao): BuscaDaSessao {
  return {
    encontrados: lerAchados(s.invariantesEncontrados),
    erros: s.invariantesErros,
    ajuda: s.invariantesAjudaEm !== null,
    errosPosAjuda: s.invariantesErrosPosAjuda,
  };
}

function alvosDe(c: ConteudoDoPacote) {
  return c.cena.invariantes.flatMap((i) => (i.alvo ? [{ id: i.id, x: i.alvo.x, y: i.alvo.y, r: i.alvo.r }] : []));
}

/** O alvo dos invariantes já achados (em ao menos uma foto) — não é mais gabarito, e a tela redesenha o dourado. */
function alvosDosAchados(c: ConteudoDoPacote, encontrados: readonly string[]) {
  const achados = new Set(encontrados.map((a) => a.split(":")[0]));
  return alvosDe(c).filter((a) => achados.has(a.id));
}

const outraFoto = (f: FotoId): FotoId => (f === "foto-1" ? "foto-2" : "foto-1");
const ehDe = <T extends string>(lista: readonly T[], v: string | null | undefined): v is T => v !== null && v !== undefined && (lista as readonly string[]).includes(v);

/** O retângulo da panorâmica que a capa publicada mostrou. */
function visivelDaCapa(s: Sessao): ReturnType<typeof retanguloVisivel> | null {
  if (!ehDe(FOTOS, s.capaFotoId)) return null;
  return retanguloVisivel(RECORTE_DA_FOTO[s.capaFotoId], lerDeslocamento(s.capaDeslocamento));
}

/** JSON com as chaves ordenadas: o JSONB reordena chaves, então o JSON cru mentiria na comparação. */
function canonico(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

const limpar = (t: string) => t.replace(/\s+/g, " ").trim();

/**
 * Os textos literais da tela, com o espaço e a hora já no lugar (e as frases
 * que dependem do artigo do espaço). `{n}` fica para a tela; sem cena, os
 * marcadores ficam como estão.
 */
function textosDaTela(c: ConteudoDoPacote | null): Record<string, Record<string, string>> {
  const preencher = (t: string) =>
    c
      ? t
          .replaceAll("{ESPACO}", c.cena.espaco.toLocaleUpperCase("pt-BR"))
          .replaceAll("{espacoCurto}", c.cena.espacoCurto)
          .replaceAll("{hora}", c.cena.hora)
      : t;
  const saida: Record<string, Record<string, string>> = {};
  for (const [grupo, frases] of Object.entries(TEXTOS)) {
    saida[grupo] = Object.fromEntries(Object.entries(frases).map(([k, v]) => [k, preencher(v)]));
  }
  if (c) {
    saida.e1!.missao = fraseDaMissao(c.cena.espacoCurto);
    saida.e4!.fora = fraseDoFora(c.cena.espacoCurto);
  }
  return saida;
}

const DISCIPLINAS_DO_RECORTE = DISCIPLINAS.map((slug) => ({ slug, rotulo: ROTULO_DA_DISCIPLINA[slug] }));

function prontos() {
  return CHAVES_PRONTAS.map((chave) => {
    const p = PACOTES_PRONTOS[chave];
    return { chave, nome: p.nome, disciplina: p.disciplina, tema: p.tema, conteudo: conteudoPronto(chave) };
  });
}

const ROTEIRO_DO_PAINEL = {
  introducao: ROTEIRO.introducao,
  regraDoArraste: ROTEIRO.regraDoArraste,
  pausa: ROTEIRO.pausa,
  cartoes: [...ROTEIRO.cartoes],
  perguntas: [...ROTEIRO.perguntas],
  liberar: ROTEIRO.liberar,
};

interface LinhaDaTurma {
  estudanteId: string;
  nome: string;
  sessao: Sessao | null;
}

type Recorte = { disciplina: Disciplina; tema: string; palavras: readonly string[]; nota?: string | null };

@Injectable()
export class EnigmaCapaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidencias: EvidenciasService,
    private readonly preparo: PreparoDaExp02ef1bService,
  ) {}

  // ─────────────────────────────────────────────────────────── leituras do estudante

  /**
   * Boot da experiência — READ-ONLY. Sem pacote no ar, `preparada: false` e a
   * tela é de espera: a missão NASCE VAZIA (a cena é a que o professor escolheu).
   */
  async sessao(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      const c = ctx.pacote?.conteudo ?? null;
      return {
        ...this.montarEstado(ctx, sessao),
        cena: c
          ? {
              chave: c.cena.chave,
              espaco: c.cena.espaco,
              espacoCurto: c.cena.espacoCurto,
              hora: c.cena.hora,
              imagem: c.cena.imagem,
              alt: c.cena.alt,
              fotos: c.cena.fotos.map((f) => ({ id: f.id, recorte: { ...f.recorte }, acao: f.acao })),
              selos: c.cena.selos.map((s) => ({ id: s.id, texto: s.texto, emoji: s.emoji })),
              invariantes: c.cena.invariantes.map((i) => ({ id: i.id, nome: i.nome })),
              fundo: { ...c.cena.fundo },
            }
          : null,
        geometria: {
          proporcaoDaPanoramica: PROPORCAO_DA_PANORAMICA,
          recortes: { "foto-1": { ...RECORTE_DA_FOTO["foto-1"] }, "foto-2": { ...RECORTE_DA_FOTO["foto-2"] } },
          faixaComum: { ...FAIXA_COMUM },
          molduraDaCapa: { ...MOLDURA_DA_CAPA },
          segundaFoto: { proporcao: PROPORCAO_DA_SEGUNDA_FOTO, moldura: { ...MOLDURA_DA_SEGUNDA_FOTO } },
          pisoDaLupaMs: PISO_DA_LUPA_MS,
          toquesForaMax: TOQUES_FORA_MAX,
        },
        material: {
          cartas: CARTAS_DOS_PARES.map((carta) => ({ id: carta.id, imagem: { tipo: "bundle" as const, nome: carta.imagem } })),
          motivos: MOTIVOS_DO_PAR.map((id) => ({ id, rotulo: ROTULO_DO_MOTIVO[id] })),
          segundaFoto: {
            imagem: { tipo: "bundle" as const, nome: SEGUNDA_FOTO.imagem },
            elementos: ELEMENTOS_DA_SEGUNDA_FOTO.map((id) => ({ id, rotulo: ROTULO_DO_ELEMENTO[id] })),
          },
        },
        textos: textosDaTela(c),
        tempos: { ...TEMPOS },
      };
    }, escolaId);
  }

  /** O polling do gate (3 s) — leve, e pelo MESMO funil (regras 7 e 8). */
  async gate(escolaId: string, estudanteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const sessao = ctx.pacote ? await this.sessaoDe(tx, escolaId, estudanteId, ctx.pacote) : null;
      return {
        preparada: ctx.pacote !== null,
        fase: ctx.pacote ? ctx.fase : null,
        rodada: ctx.pacote?.rodada ?? null,
        atividade: ctx.pacote ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada } : null,
        passo: passoEfetivo(marcosDe(sessao), ctx.fase),
        agora: new Date().toISOString(),
      };
    }, escolaId);
  }

  // ─────────────────────────────────────────────────────────── jogadas do estudante

  /** E1: ABRIR BANCADA abre a sessão desta rodada (`entrou_em` = agora). Idempotente. */
  iniciar(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      if (sessao) return {};
      await tx.exp02ef1bSessao.createMany({
        data: [
          {
            escolaId,
            estudanteId,
            pacoteId: pacote.id,
            rodada: pacote.rodada,
            turmaId: pacote.turmaId,
            versaoInstrumento: VERSAO_DO_INSTRUMENTO,
          },
        ],
        skipDuplicates: true,
      });
      return {};
    });
  }

  /**
   * E2: o relato da lupa — o tempo com a lente sobre cada um dos dois objetos
   * do fundo. Guarda o MÁXIMO (limitado ao tempo desde a entrada); com
   * `avancar`, confere o piso — cumprido, libera o `decidir`; senão conta um
   * alerta ("OLHE O FUNDO"). Depois de liberada, devolve o estado.
   */
  lupa(escolaId: string, estudanteId: string, relato: RelatoDaLupa) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      const s = this.exigirSessao(sessao);
      if (s.lupaLiberadaEm) return { liberado: true, alerta: false };
      const agora = new Date();
      const nova = acumularLupa({ alvo1Ms: s.lupaAlvo1Ms, alvo2Ms: s.lupaAlvo2Ms }, relato, agora.getTime() - s.entrouEm.getTime());
      const liberado = relato.avancar && pisoCumprido(nova);
      const alerta = relato.avancar && !liberado;
      await tx.exp02ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          lupaAlvo1Ms: nova.alvo1Ms,
          lupaAlvo2Ms: nova.alvo2Ms,
          ...(alerta ? { lupaAlertas: Math.min(999, s.lupaAlertas + 1) } : {}),
          ...(liberado ? { lupaLiberadaEm: agora } : {}),
        },
      });
      return { liberado, alerta };
    });
  }

  /**
   * E3: PUBLICAR CAPA — o LATCH 1. Foto, selo, deslocamento, a coerência do
   * selo, a fala da visitante, o núcleo visível e o carimbo no MESMO UPDATE (o
   * CHECK cobra os sete juntos). A mesma foto e o mesmo selo de novo são
   * idempotentes; outra escolha, 409.
   */
  publicar(escolaId: string, estudanteId: string, fotoId: FotoId, seloId: SeloId, deslocamento: Deslocamento) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      const s = this.exigirSessao(sessao);
      if (s.capaPublicadaEm) {
        if (s.capaFotoId === fotoId && s.capaSeloId === seloId) return { visitante: s.visitanteFala ?? "" };
        throw erroDeJogo("ja-publicado");
      }
      if (!s.lupaLiberadaEm) throw erroDeJogo("passo-invalido");
      const foto = pacote.conteudo.cena.fotos.find((f) => f.id === fotoId);
      if (!foto) throw erroDeJogo("payload-invalido");
      const visivel = retanguloVisivel(foto.recorte, deslocamento);
      const { fala, nucleoVisivel } = falaDaVisitante(foto, visivel, pacote.conteudo.cena.espacoCurto);
      await tx.exp02ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          capaFotoId: fotoId,
          capaSeloId: seloId,
          capaDeslocamento: { x: deslocamento.x, y: deslocamento.y },
          capaSeloCoerente: foto.seloCoerente === seloId,
          visitanteFala: fala,
          capaNucleoVisivel: nucleoVisivel,
          capaPublicadaEm: new Date(),
        },
      });
      return { visitante: fala };
    });
  }

  /**
   * E4, Momento 4: um toque na busca dos invariantes — só depois da virada.
   * O gabarito (os alvos) é daqui; no 3º erro a ajuda acende e os alvos descem
   * para o pulso. Os quatro achados completam e marcam a EF02CO01 na MESMA
   * transação.
   */
  tocarInvariante(escolaId: string, estudanteId: string, fotoId: FotoId, ponto: Ponto) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      const s = this.exigirSessao(sessao);
      if (!s.capaPublicadaEm) throw erroDeJogo("passo-invalido");
      if (fase !== "virada") throw erroDeJogo("virada-nao-liberada");
      const r = tocar(buscaDe(s), pacote.conteudo.cena.invariantes, fotoId, ponto);
      if (!r.ok) {
        if (r.motivo === "fora-da-foto") throw erroDeJogo("toque-fora-da-foto");
        /* O CHECK `exp02ef1b_pacotes_alvos_check` não deixa um pacote sem alvos ir ao ar. */
        throw new Error("pacote no ar sem os alvos dos invariantes");
      }
      if (r.mudou) {
        const agora = new Date();
        await tx.exp02ef1bSessao.update({
          where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
          data: {
            invariantesEncontrados: r.busca.encontrados,
            invariantesErros: r.busca.erros,
            invariantesErrosPosAjuda: Math.min(999, r.busca.errosPosAjuda),
            ...(r.ajudaAcendeu ? { invariantesAjudaEm: agora } : {}),
            ...(r.completou ? { invariantesConcluidoEm: agora } : {}),
          },
        });
      }
      if (r.completou) {
        await this.evidencias.marcar(tx, {
          ...this.marcaDe(escolaId, estudanteId, pacote),
          marcador: MARCADOR_CO01,
          status: nivelCO01({ ajuda: r.busca.ajuda, errosPosAjuda: r.busca.errosPosAjuda }),
        });
      }
      return {
        toque: {
          acerto: r.acerto,
          encontrados: r.busca.encontrados,
          erros: r.busca.erros,
          ajuda: r.busca.ajuda,
          ...(r.busca.ajuda ? { alvos: alvosDe(pacote.conteudo) } : {}),
          achados: alvosDosAchados(pacote.conteudo, r.busca.encontrados),
          completo: completa(r.busca),
        },
      };
    });
  }

  /** E4, Momento 5: o slider abriu a panorâmica. Idempotente. */
  abrirPanoramica(escolaId: string, estudanteId: string) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao, fase) => {
      const s = this.exigirSessao(sessao);
      if (s.panoramicaAbertaEm) return {};
      if (s.capaPublicadaEm && fase !== "virada") throw erroDeJogo("virada-nao-liberada");
      if (!s.invariantesConcluidoEm) throw erroDeJogo("passo-invalido");
      await tx.exp02ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { panoramicaAbertaEm: new Date() },
      });
      return {};
    });
  }

  /**
   * E4, Momento 5: "Marque n{espaço} o que ficou fora da sua foto." + "Pronto".
   * Os alfinetes viram os marcáveis que ficaram FORA da capa publicada (metade
   * ou mais da área fora). É o 4º indicador da régua: marca a EF02CO05 (o
   * foco) na MESMA transação, com a lupa, o selo e os invariantes da sessão.
   */
  marcarFora(escolaId: string, estudanteId: string, toques: readonly Ponto[]) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      const s = this.exigirSessao(sessao);
      if (s.foraEm) return {};
      if (!s.panoramicaAbertaEm) throw erroDeJogo("passo-invalido");
      const visivel = visivelDaCapa(s);
      const itens = visivel ? itensFora(pacote.conteudo.cena.marcaveis, visivel, toques) : [];
      await tx.exp02ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { foraToques: toques.map((t) => ({ x: t.x, y: t.y })), foraItens: itens, foraEm: new Date() },
      });
      await this.evidencias.marcar(tx, {
        ...this.marcaDe(escolaId, estudanteId, pacote),
        marcador: MARCADOR_CO05,
        status: nivelCO05({
          lupa: grauDaLupa(s.lupaAlertas),
          selo: grauDoSelo(s.capaSeloCoerente === true),
          invariantes: grauDosInvariantes({ ajuda: s.invariantesAjudaEm !== null, errosPosAjuda: s.invariantesErrosPosAjuda }),
          fora: grauDoFora(itens.length),
        }),
      });
      return {};
    });
  }

  /** E5: o par e o motivo. Só painel. */
  formarPar(escolaId: string, estudanteId: string, cartas: readonly [string, string], motivo: MotivoDoPar) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      const s = this.exigirSessao(sessao);
      if (s.parEm) return {};
      if (!s.foraEm) throw erroDeJogo("passo-invalido");
      const correto = parCorreto(cartas);
      if (correto === null) throw erroDeJogo("carta-desconhecida");
      await tx.exp02ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: { parCartas: [...cartas], parMotivo: motivo, parCorreto: correto, parEm: new Date() },
      });
      return {};
    });
  }

  /** E5: a segunda foto — o elemento e a posição na moldura fixa ("Colocar no álbum"). Só painel; CONCLUI a missão. */
  segundaFoto(escolaId: string, estudanteId: string, elemento: ElementoDaSegundaFoto, deslocamento: Deslocamento) {
    return this.comSessao(escolaId, estudanteId, async (tx, pacote, sessao) => {
      const s = this.exigirSessao(sessao);
      if (s.segundaEm) return {};
      if (!s.parEm) throw erroDeJogo("passo-invalido");
      const agora = new Date();
      await tx.exp02ef1bSessao.update({
        where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) },
        data: {
          segundaElemento: elemento,
          segundaDeslocamento: { x: deslocamento.x, y: deslocamento.y },
          segundaEssencialVisivel: essencialVisivelNaSegunda(deslocamento),
          segundaEm: agora,
          concluidoEm: agora,
        },
      });
      return {};
    });
  }

  // ─────────────────────────────────────────────────────────── o professor

  /** As turmas para o seletor: por MATRÍCULA para o professor; o gestor vê a escola. */
  async turmas(escolaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turmas = await tx.turma.findMany({
        where: ondeAsTurmasSaoVisiveis(escolaId, professorId),
        select: { id: true, nome: true, serie: true, _count: { select: { estudantes: true } } },
        orderBy: [{ serie: "asc" }, { nome: "asc" }],
      });
      return { turmas: turmas.map((t) => ({ id: t.id, nome: t.nome, serie: t.serie, estudantes: t._count.estudantes })) };
    }, escolaId);
  }

  /** O pacote da turma: o em andamento, o rascunho e os prontos — COM o gabarito (é o roteiro do professor). */
  async pacoteDaTurma(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [ativo, rascunho] = await Promise.all([
        tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true } }),
        tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } }),
      ]);
      return {
        turma,
        ativo: ativo ? this.paraProfessor(ativo) : null,
        rascunho: rascunho ? this.paraProfessor(rascunho) : null,
        prontos: prontos(),
        disciplinas: DISCIPLINAS_DO_RECORTE,
      };
    }, escolaId);
  }

  /** O rascunho da turma (a curadoria), ou `null`. */
  async rascunho(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } });
      return { rascunho: linha ? this.paraProfessor(linha) : null };
    }, escolaId);
  }

  /**
   * "Gerar com IA" — o RASCUNHO da cena (texto + panorâmica). A turma é
   * conferida ANTES de gastar token; sem saldo ou com o vendor fora, o
   * rascunho sai do pacote pronto da disciplina (`usouIa: false`, `motivo`).
   * Gerar de novo SUBSTITUI o rascunho (um por turma) — o "GERAR NOVAMENTE".
   */
  async gerar(escolaId: string, turmaId: string, professorId: string, perfil: Perfil, recorte: z.infer<typeof GerarSchema>) {
    await this.prisma.comTenancy((tx) => this.turmaVisivel(tx, escolaId, turmaId, professorId), escolaId);
    const limpo: Recorte = {
      disciplina: recorte.disciplina,
      tema: limpar(recorte.tema),
      palavras: recorte.palavras.map(limpar),
      nota: recorte.nota ? limpar(recorte.nota) || null : null,
    };
    const resultado = await this.preparo.gerar(escolaId, professorId, perfil, limpo);
    const chavePronta = PRONTO_DA_DISCIPLINA[limpo.disciplina];
    const conteudo = resultado.conteudo ?? conteudoPronto(chavePronta);
    const dados = resultado.conteudo
      ? { disciplina: limpo.disciplina, tema: limpo.tema, palavras: [...limpo.palavras], nota: limpo.nota ?? null, chaveCena: "ia" as ChaveDeCena, origem: "ia" as Origem }
      : {
          disciplina: limpo.disciplina,
          tema: PACOTES_PRONTOS[chavePronta].tema,
          palavras: [...PACOTES_PRONTOS[chavePronta].palavras],
          nota: null,
          chaveCena: chavePronta as ChaveDeCena,
          origem: "padrao" as Origem,
        };

    const rascunho = await this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const existente = await tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null }, select: { id: true } });
      const comum = { ...dados, conteudoJson: conteudo as unknown as Prisma.InputJsonValue };
      const gerou = resultado.tokens > 0 ? 1 : 0;
      return existente
        ? tx.exp02ef1bPacote.update({
            where: { id: existente.id },
            data: { ...comum, iaGeracoes: { increment: gerou }, iaTokens: { increment: resultado.tokens } },
          })
        : tx.exp02ef1bPacote.create({ data: { escolaId, turmaId, ...comum, iaGeracoes: gerou, iaTokens: resultado.tokens } });
    }, escolaId);

    const motivo: MotivoDoPronto | null = resultado.motivo;
    return { rascunho: this.exigirParaProfessor(rascunho), usouIa: resultado.conteudo !== null, motivo };
  }

  /**
   * "Toque no RELÓGIO": o professor marca os dois objetos iguais na imagem do
   * rascunho (raio `RAIO_PADRAO`). Fora da faixa comum, 400 com as frases.
   */
  async marcarAlvos(escolaId: string, turmaId: string, professorId: string, corpo: z.infer<typeof AlvosDoRascunhoSchema>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } });
      if (!linha) throw erroDeJogo("rascunho-nao-encontrado");
      const conteudo = lerConteudo(linha.conteudoJson);
      if (!conteudo) throw erroDeJogo("rascunho-nao-encontrado");
      for (const inv of conteudo.cena.invariantes) {
        const toque = corpo.alvos.find((a) => a.id === inv.id);
        if (toque) inv.alvo = { x: toque.x, y: toque.y, r: RAIO_PADRAO };
      }
      const problemas = problemasDoConteudo(conteudo, { exigirAlvos: true });
      if (problemas.length > 0) throw erroDeJogo("pacote-invalido", problemas);
      const nova = await tx.exp02ef1bPacote.update({
        where: { id: linha.id },
        data: { conteudoJson: conteudo as unknown as Prisma.InputJsonValue },
      });
      return this.exigirParaProfessor(nova);
    }, escolaId);
  }

  /**
   * "Aprovar" — o portão da curadoria humana. O rascunho vira atividade
   * PRONTA (não no ar, ADR-130), com os textos curtos que o professor editou.
   * Exige os dois alvos. O duplo clique devolve o mesmo pacote.
   */
  async homologar(escolaId: string, turmaId: string, professorId: string, corpo: z.infer<typeof HomologarSchema>) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const linha = await tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, aprovadoEm: null } });
      if (!linha) {
        const ja = await tx.exp02ef1bPacote.findFirst({ where: { id: corpo.rascunhoId, escolaId, turmaId, aprovadoEm: { not: null } } });
        if (ja) return this.exigirParaProfessor(ja);
        throw erroDeJogo("rascunho-nao-encontrado");
      }
      if (linha.id !== corpo.rascunhoId) throw erroDeJogo("rascunho-desatualizado");
      const conteudo = lerConteudo(linha.conteudoJson);
      if (!conteudo) throw erroDeJogo("rascunho-nao-encontrado");
      for (const e of corpo.selos ?? []) {
        const selo = conteudo.cena.selos.find((s) => s.id === e.id);
        if (selo) Object.assign(selo, { texto: limpar(e.texto), emoji: e.emoji.trim() });
      }
      for (const e of corpo.falas ?? []) {
        const foto = conteudo.cena.fotos.find((f) => f.id === e.fotoId);
        if (foto) foto.visitante = limpar(e.visitante);
      }
      const problemas = problemasDoConteudo(conteudo, { exigirAlvos: true });
      if (problemas.length > 0) throw erroDeJogo("pacote-invalido", problemas);
      const aprovado = await tx.exp02ef1bPacote.update({
        where: { id: linha.id },
        data: {
          conteudoJson: conteudo as unknown as Prisma.InputJsonValue,
          ativo: false,
          rodadaAtual: 1,
          aprovadoEm: new Date(),
          aprovadoPor: professorId,
        },
      });
      return this.exigirParaProfessor(aprovado);
    }, escolaId);
  }

  /**
   * "USAR BANCO PADRÃO (BIBLIOTECA)" e os prontos Horta e Museu — o caminho
   * curto: homologa o pacote pronto E o põe no ar, numa transação, sem tocar
   * no rascunho da IA. O mesmo pronto já homologado nesta turma é REUSADO (a
   * mesma atividade, com as rodadas dela).
   */
  async usarBancoPadrao(escolaId: string, turmaId: string, professorId: string, chave: ChavePronta) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pronto = PACOTES_PRONTOS[chave];
      const conteudo = conteudoPronto(chave);
      const assinatura = canonico(conteudo);
      const candidatos = await tx.exp02ef1bPacote.findMany({
        where: { escolaId, turmaId, origem: "padrao", chaveCena: chave, aprovadoEm: { not: null } },
        orderBy: { aprovadoEm: "desc" },
      });
      const existente = candidatos.find((c) => canonico(c.conteudoJson) === assinatura);
      const linha =
        existente ??
        (await tx.exp02ef1bPacote.create({
          data: {
            escolaId,
            turmaId,
            disciplina: pronto.disciplina,
            tema: pronto.tema,
            palavras: [...pronto.palavras],
            nota: null,
            chaveCena: chave,
            origem: "padrao",
            conteudoJson: conteudo as unknown as Prisma.InputJsonValue,
            ativo: false,
            rodadaAtual: 1,
            aprovadoEm: new Date(),
            aprovadoPor: professorId,
          },
        }));
      return this.porNoAr(tx, escolaId, turmaId, linha);
    }, escolaId);
  }

  /** As ATIVIDADES da turma: os pacotes homologados, com o em andamento marcado. */
  async pacotes(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const [aprovados, rodadas] = await Promise.all([
        tx.exp02ef1bPacote.findMany({
          where: { escolaId, turmaId, aprovadoEm: { not: null } },
          orderBy: { aprovadoEm: "desc" },
          select: { id: true, disciplina: true, tema: true, chaveCena: true, origem: true, ativo: true, rodadaAtual: true, aprovadoEm: true },
        }),
        tx.exp02ef1bSessao.groupBy({ by: ["pacoteId"], where: { escolaId, turmaId }, _max: { rodada: true } }),
      ]);
      const maiorRodada = new Map(rodadas.map((r) => [r.pacoteId, r._max.rodada ?? 0]));
      const emAndamento = aprovados.find((p) => p.ativo);
      return {
        emAndamento: emAndamento ? { pacoteId: emAndamento.id, rodada: emAndamento.rodadaAtual } : null,
        historico: aprovados.map((p) => ({
          id: p.id,
          disciplina: (ehDe(DISCIPLINAS, p.disciplina) ? p.disciplina : "outra") as Disciplina,
          tema: p.tema,
          chaveDaCena: p.chaveCena as ChaveDeCena,
          origem: (p.origem === "ia" ? "ia" : "padrao") as Origem,
          ativo: p.ativo,
          aprovadoEm: (p.aprovadoEm as Date).toISOString(),
          rodadas: maiorRodada.get(p.id) ?? 0,
        })),
      };
    }, escolaId);
  }

  /** UM pacote homologado, inteiro e com o gabarito. */
  async pacote(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const linha = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, pacoteId);
      const rodadas = await tx.exp02ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId }, _max: { rodada: true } });
      return { ...this.exigirParaProfessor(linha), rodadas: rodadas._max.rodada ?? 0 };
    }, escolaId);
  }

  /** O pacote do podcast (ADR-150): o pedido, desta turma, ou o em andamento. */
  async pacoteParaPodcast(escolaId: string, turmaId: string, professorId: string | undefined, pacoteId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const id = pacoteId ?? (await this.exigirPacoteAtivo(tx, escolaId, turmaId)).id;
      const linha = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, id);
      return { id: linha.id, tema: linha.tema };
    }, escolaId);
  }

  /**
   * "Usar esta atividade agora" — o professor escolhe o pacote que a turma usa
   * (ADR-130). O que estava em andamento volta a ser pronto; a fase volta à
   * `aberta`; o pacote que já rodou abre a rodada SEGUINTE. Idempotente.
   */
  async colocarEmAndamento(escolaId: string, turmaId: string, professorId: string, pacoteId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.pacoteAprovadoDaTurma(tx, escolaId, turmaId, pacoteId);
      return this.porNoAr(tx, escolaId, turmaId, pacote);
    }, escolaId);
  }

  /**
   * "LIBERAR VIRADA" — GERAL da turma (decisão do Lucas, 2026-10-26; o PO
   * pedia por estudante). Só para a frente; a mudança entra no histórico
   * (EVT-P05). É a linha que o polling do estudante lê.
   */
  async mudarGate(escolaId: string, turmaId: string, professorId: string) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      const atual = await tx.exp02ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      const antes = normalizarFase(atual?.fase);
      const fase = avancarFase(antes, "virada");
      const linha = await tx.exp02ef1bGateTurma.upsert({
        where: { escolaId_turmaId: { escolaId, turmaId } },
        create: { escolaId, turmaId, fase },
        update: { fase },
      });
      if (fase !== antes) {
        await tx.exp02ef1bGateHistorico.create({
          data: { escolaId, turmaId, pacoteId: pacote.id, rodada: pacote.rodadaAtual, fase, professorId },
        });
      }
      return { fase, atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, atualizadoEm: linha.atualizadoEm.toISOString() };
    }, escolaId);
  }

  /**
   * "Zerar" — a rodada seguinte do mesmo pacote, e a evidência dele APAGADA
   * (ADR-155); a fase volta à `aberta`. As sessões ficam. `rodada` é a que o
   * professor VIU.
   */
  async novaRodada(escolaId: string, turmaId: string, professorId: string, rodadaVista: number) {
    return this.prisma.comTenancy(async (tx) => {
      await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      await this.travarTurma(tx, escolaId, turmaId);
      const pacote = await this.exigirPacoteAtivo(tx, escolaId, turmaId);
      if (pacote.rodadaAtual === rodadaVista + 1) {
        const gate = await tx.exp02ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
        return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase) };
      }
      if (pacote.rodadaAtual !== rodadaVista) throw erroDeJogo("rodada-desatualizada");
      await apagarEvidenciaDaAtividade(tx, { escolaId, turmaId, expId: EXP_ID, atividadeId: pacote.id });
      const atualizado = await tx.exp02ef1bPacote.update({
        where: { id: pacote.id },
        data: { rodadaAtual: { increment: 1 } },
        select: { id: true, rodadaAtual: true },
      });
      await this.voltarAoInicio(tx, escolaId, turmaId);
      return { atividade: { pacoteId: atualizado.id, rodada: atualizado.rodadaAtual }, fase: FASE_INICIAL };
    }, escolaId);
  }

  /**
   * O PAINEL da aula — por estudante, pelo NOME (por COMPUTADOR quando há
   * equipe): o passo, a lupa, a capa (foto, selo coerente, visitante), os
   * invariantes, o "fora" (marcou X de Y), o par e a segunda foto. O NÍVEL de cada
   * habilidade é da evidência (E14), não daqui. Não há texto livre na missão.
   */
  async painel(escolaId: string, turmaId: string, professorId?: string) {
    return this.prisma.comTenancy(async (tx) => {
      const turma = await this.turmaVisivel(tx, escolaId, turmaId, professorId);
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const { unidades, mapa } = await this.lerATurma(tx, escolaId, turmaId, ctx.pacote);
      const linhas = unidades.map(({ linha, equipe }) => this.linhaDoPainel(linha, equipe, ctx));
      return {
        turma,
        atividade: ctx.pacote
          ? { pacoteId: ctx.pacote.id, rodada: ctx.pacote.rodada, tema: ctx.pacote.tema, espaco: ctx.pacote.conteudo.cena.espaco }
          : null,
        fase: ctx.pacote ? ctx.fase : null,
        porComputador: mapa.size > 0,
        resumo: {
          unidades: linhas.length,
          entraram: linhas.filter((l) => l.lupa !== null).length,
          publicaram: linhas.filter((l) => l.capa !== null).length,
          aguardandoVirada: linhas.filter((l) => l.aguardandoVirada).length,
          concluiram: linhas.filter((l) => l.passo === "concluida").length,
          marcaramFora: linhas.filter((l) => (l.fora?.itens.length ?? 0) >= 1).length,
        },
        linhas,
        roteiro: ROTEIRO_DO_PAINEL,
      };
    }, escolaId);
  }

  /** O material do GUIA DA AULA: os prontos COM o gabarito, as disciplinas, o roteiro, as cartas e as réguas. Sem tenancy: é catálogo. */
  material() {
    return {
      prontos: prontos(),
      disciplinas: DISCIPLINAS_DO_RECORTE,
      roteiro: ROTEIRO_DO_PAINEL,
      cartas: CARTAS_DOS_PARES.map((c) => ({ id: c.id, descricao: c.descricao, atividade: c.atividade, cor: c.cor })),
      habilidades: FICHA_EXP02EF1B.habilidades.map((h) => ({
        codigo: h.codigo,
        rotulo: h.marcadores[0]?.rotulo ?? h.codigo,
        criterios: { atingiu: h.criterios.atingiu, em_processo: h.criterios.em_processo, nao_atingiu: h.criterios.nao_atingiu },
      })),
    };
  }

  // ─────────────────────────────────────────────────────────── privados

  /** O estado do estudante, depois de uma leitura ou de uma mutação. Allowlist: nada do gabarito. */
  private montarEstado(ctx: ContextoDaTurma, s: Sessao | null): Estado {
    const pacote = ctx.pacote;
    const passo = passoEfetivo(marcosDe(s), ctx.fase);
    const virou = ctx.fase === "virada";
    const capaFoto = s && ehDe(FOTOS, s.capaFotoId) ? s.capaFotoId : null;
    const busca = s ? buscaDe(s) : null;
    const visivel = s ? visivelDaCapa(s) : null;
    return {
      passo,
      fase: pacote ? ctx.fase : null,
      preparada: pacote !== null,
      aguardandoVirada: passo === "feed",
      atividade: pacote ? { pacoteId: pacote.id, rodada: pacote.rodada } : null,
      lupa: s
        ? {
            alvo1Ms: s.lupaAlvo1Ms,
            alvo2Ms: s.lupaAlvo2Ms,
            alertas: s.lupaAlertas,
            liberada: s.lupaLiberadaEm !== null,
            /* A exceção da ADR-186: o brilho da lente precisa do lugar — só no passo da lupa. */
            alvos: passo === "lupa" && pacote ? alvosDe(pacote.conteudo) : null,
          }
        : null,
      capa:
        s && s.capaPublicadaEm && capaFoto && visivel && ehDe(["selo-1", "selo-2"] as const, s.capaSeloId)
          ? {
              fotoId: capaFoto,
              outraFotoId: outraFoto(capaFoto),
              seloId: s.capaSeloId,
              deslocamento: lerDeslocamento(s.capaDeslocamento),
              visivel: arredondar(visivel),
              visitante: s.visitanteFala ?? "",
              publicadaEm: s.capaPublicadaEm.toISOString(),
            }
          : null,
      invariantes:
        s && busca && s.capaPublicadaEm && virou && pacote
          ? {
              encontrados: busca.encontrados,
              erros: busca.erros,
              ajuda: busca.ajuda,
              alvos: busca.ajuda ? alvosDe(pacote.conteudo) : null,
              achados: alvosDosAchados(pacote.conteudo, busca.encontrados),
              completo: completa(busca),
            }
          : null,
      panoramicaAberta: Boolean(s?.panoramicaAbertaEm),
      fora: s?.foraEm ? { toques: lerPontos(s.foraToques) } : null,
      pares: s?.parEm && ehDe(MOTIVOS_DO_PAR, s.parMotivo) ? { cartas: [...s.parCartas], motivo: s.parMotivo } : null,
      segundaFoto:
        s?.segundaEm && ehDe(ELEMENTOS_DA_SEGUNDA_FOTO, s.segundaElemento)
          ? { elemento: s.segundaElemento, deslocamento: lerDeslocamento(s.segundaDeslocamento) }
          : null,
      concluido: passo === "concluida",
    };
  }

  private linhaDoPainel(linha: LinhaDaTurma, equipe: EquipeDoMapa | null, ctx: ContextoDaTurma): z.infer<typeof LinhaDoPainelSchema> {
    const s = linha.sessao;
    const passo = passoEfetivo(marcosDe(s), ctx.fase);
    const marcaveis = ctx.pacote?.conteudo.cena.marcaveis ?? [];
    const visivel = s ? visivelDaCapa(s) : null;
    const busca = s ? buscaDe(s) : null;
    return {
      estudanteId: linha.estudanteId,
      nome: linha.nome,
      equipe: equipe ? { id: equipe.id, nome: equipe.nome, membros: equipe.membros.map((m) => ({ id: m.id, nome: m.nome })) } : null,
      passo,
      aguardandoVirada: passo === "feed",
      lupa: s ? { alvo1Ms: s.lupaAlvo1Ms, alvo2Ms: s.lupaAlvo2Ms, alertas: s.lupaAlertas, liberada: s.lupaLiberadaEm !== null } : null,
      capa:
        s?.capaPublicadaEm && ehDe(FOTOS, s.capaFotoId) && ehDe(["selo-1", "selo-2"] as const, s.capaSeloId)
          ? {
              fotoId: s.capaFotoId,
              seloId: s.capaSeloId,
              seloCoerente: s.capaSeloCoerente === true,
              visitante: s.visitanteFala ?? "",
              nucleoVisivel: s.capaNucleoVisivel === true,
            }
          : null,
      invariantes:
        s && busca && (busca.encontrados.length > 0 || busca.erros > 0 || s.invariantesConcluidoEm)
          ? {
              encontrados: busca.encontrados.length,
              erros: busca.erros,
              ajuda: busca.ajuda,
              errosPosAjuda: busca.errosPosAjuda,
              completo: s.invariantesConcluidoEm !== null,
            }
          : null,
      fora: s?.foraEm
        ? {
            itens: s.foraItens.map((id) => ({ id, nome: marcaveis.find((m) => m.id === id)?.nome ?? id })),
            possiveis: visivel ? marcaveisFora(marcaveis, visivel).length : 0,
          }
        : null,
      par: s?.parEm && ehDe(MOTIVOS_DO_PAR, s.parMotivo) ? { cartas: [...s.parCartas], motivo: s.parMotivo, correto: s.parCorreto === true } : null,
      segundaFoto:
        s?.segundaEm && ehDe(ELEMENTOS_DA_SEGUNDA_FOTO, s.segundaElemento)
          ? { elemento: s.segundaElemento, essencialVisivel: s.segundaEssencialVisivel === true }
          : null,
    };
  }

  private exigirSessao(sessao: Sessao | null): Sessao {
    if (!sessao) throw erroDeJogo("sessao-nao-aberta");
    return sessao;
  }

  private async porNoAr(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacote: Exp02ef1bPacote) {
    if (pacote.ativo) {
      const gate = await tx.exp02ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } } });
      return { atividade: { pacoteId: pacote.id, rodada: pacote.rodadaAtual }, fase: normalizarFase(gate?.fase), mudou: false };
    }
    const ultima = await tx.exp02ef1bSessao.aggregate({ where: { escolaId, turmaId, pacoteId: pacote.id }, _max: { rodada: true } });
    const rodada = (ultima._max.rodada ?? 0) + 1;
    /* Desliga antes de ligar: o índice único PARCIAL aceita um ativo por turma. */
    await tx.exp02ef1bPacote.updateMany({ where: { escolaId, turmaId, ativo: true }, data: { ativo: false } });
    await tx.exp02ef1bPacote.update({ where: { id: pacote.id }, data: { ativo: true, rodadaAtual: rodada } });
    await this.voltarAoInicio(tx, escolaId, turmaId);
    return { atividade: { pacoteId: pacote.id, rodada }, fase: FASE_INICIAL, mudou: true };
  }

  /** A TURMA desta rodada, colapsada em UNIDADES (um computador = uma equipe, ou uma criança). */
  private async lerATurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacote: PacoteDaTurma | null) {
    const estudantes = await tx.user.findMany({
      where: { escolaId, turmaId, role: "estudante" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    });
    const sessoes = pacote
      ? await tx.exp02ef1bSessao.findMany({
          where: { escolaId, pacoteId: pacote.id, rodada: pacote.rodada, estudanteId: { in: estudantes.map((e) => e.id) } },
        })
      : [];
    const sessaoDe = new Map(sessoes.map((s) => [s.estudanteId, s]));
    const linhas: LinhaDaTurma[] = estudantes.map((e) => ({ estudanteId: e.id, nome: e.displayName, sessao: sessaoDe.get(e.id) ?? null }));
    const mapa: Map<string, EquipeDoMapa> = pacote ? await mapaDeEquipes(tx, escolaId, turmaId, EXP_ID, pacote.id) : new Map();
    const unidades = colapsarEmUnidades(
      linhas,
      (l) => l.estudanteId,
      mapa,
      (l) => l.sessao !== null,
      (l) => l.sessao?.atualizadoEm.getTime() ?? 0,
    );
    return { unidades, mapa };
  }

  private async contextoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string | null): Promise<ContextoDaTurma> {
    if (!turmaId) return { turmaId: null, pacote: null, fase: null };
    const [linha, gate] = await Promise.all([
      tx.exp02ef1bPacote.findFirst({
        where: { escolaId, turmaId, ativo: true },
        select: { id: true, turmaId: true, tema: true, conteudoJson: true, rodadaAtual: true },
      }),
      tx.exp02ef1bGateTurma.findUnique({ where: { escolaId_turmaId: { escolaId, turmaId } }, select: { fase: true } }),
    ]);
    if (!linha) return { turmaId, pacote: null, fase: null };
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo) {
      logger.warn({ codigo: "exp02ef1b-pacote-invalido", escolaId, turmaId }, "pacote ativo com forma inesperada");
      return { turmaId, pacote: null, fase: null };
    }
    return {
      turmaId,
      pacote: { id: linha.id, turmaId: linha.turmaId, tema: linha.tema, conteudo, rodada: linha.rodadaAtual },
      fase: normalizarFase(gate?.fase),
    };
  }

  private chave(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, estudanteId, pacoteId: pacote.id, rodada: pacote.rodada };
  }

  /** A marca de uma ação desta missão: a atividade é o pacote, a rodada é a da turma. */
  private marcaDe(escolaId: string, estudanteId: string, pacote: PacoteDaTurma) {
    return { escolaId, expId: EXP_ID, turmaId: pacote.turmaId, atividadeId: pacote.id, rodada: pacote.rodada, estudanteId };
  }

  private sessaoDe(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string, pacote: PacoteDaTurma): Promise<Sessao | null> {
    return tx.exp02ef1bSessao.findUnique({ where: { escolaId_estudanteId_pacoteId_rodada: this.chave(escolaId, estudanteId, pacote) } });
  }

  /**
   * O FUNIL de toda rota de estudante: a escola do token e a missão liberada
   * na turma (ADR-69, e a disponibilidade da ADR-87 dentro dela). A turma é a
   * de `users.turma_id` — a mesma fonte do painel e das equipes.
   */
  private async estudanteDaEscola(tx: Prisma.TransactionClient, escolaId: string, estudanteId: string) {
    const estudante = await tx.user.findUnique({ where: { id: estudanteId }, select: { escolaId: true, turmaId: true } });
    if (!estudante || estudante.escolaId !== escolaId) throw erroDeJogo("turma-nao-encontrada");
    await exigirMissaoLiberada(tx, escolaId, estudanteId, EXP_ID);
    return { turmaId: estudante.turmaId };
  }

  /**
   * Núcleo de toda jogada: funil, lock por (escola, estudante), o pacote e a
   * fase lidos UMA vez, o trabalho, e o estado relido — com o resultado
   * próprio da jogada (`liberado`, `visitante`, `toque`) por cima. Dois toques
   * rápidos viram duas transações em fila. Os CHECKs do banco são a rede final.
   */
  private comSessao<E extends object>(
    escolaId: string,
    estudanteId: string,
    trabalho: (tx: Prisma.TransactionClient, pacote: PacoteDaTurma, sessao: Sessao | null, fase: Fase | null) => Promise<E>,
  ): Promise<Estado & E> {
    return this.prisma.comTenancy(async (tx) => {
      const { turmaId } = await this.estudanteDaEscola(tx, escolaId, estudanteId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp02ef1b:${escolaId}:${estudanteId}`}, 0))`;
      const ctx = await this.contextoDaTurma(tx, escolaId, turmaId);
      const pacote = ctx.pacote;
      if (!pacote) throw erroDeJogo("radio-em-preparo");
      const extra = await trabalho(tx, pacote, await this.sessaoDe(tx, escolaId, estudanteId, pacote), ctx.fase);
      return { ...this.montarEstado(ctx, await this.sessaoDe(tx, escolaId, estudanteId, pacote)), ...extra };
    }, escolaId);
  }

  /** Escola do token E matrícula de professor na turma. **404, nunca 403**. `professorId` indefinido = gestor. */
  private async turmaVisivel(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, professorId?: string) {
    const turma = await tx.turma.findFirst({ where: { id: turmaId, escolaId }, select: { id: true, nome: true, serie: true } });
    if (!turma || !(await professorLeciona(tx, escolaId, turmaId, professorId))) throw erroDeJogo("turma-nao-encontrada");
    return turma;
  }

  /** Lock por TURMA: dois professores (ou dois cliques) não intercalam homologação, fase e rodada. */
  private async travarTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`exp02ef1b-turma:${escolaId}:${turmaId}`}, 0))`;
  }

  private async pacoteAprovadoDaTurma(tx: Prisma.TransactionClient, escolaId: string, turmaId: string, pacoteId: string) {
    const linha = ehUuid(pacoteId)
      ? await tx.exp02ef1bPacote.findFirst({ where: { id: pacoteId, escolaId, turmaId, aprovadoEm: { not: null } } })
      : null;
    if (!linha) throw erroDeJogo("atividade-nao-encontrada");
    return linha;
  }

  private async exigirPacoteAtivo(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    const pacote = await tx.exp02ef1bPacote.findFirst({ where: { escolaId, turmaId, ativo: true }, select: { id: true, rodadaAtual: true } });
    if (!pacote) throw erroDeJogo("pacote-nao-aprovado");
    return pacote;
  }

  private voltarAoInicio(tx: Prisma.TransactionClient, escolaId: string, turmaId: string) {
    return tx.exp02ef1bGateTurma.upsert({
      where: { escolaId_turmaId: { escolaId, turmaId } },
      create: { escolaId, turmaId, fase: FASE_INICIAL },
      update: { fase: FASE_INICIAL },
    });
  }

  /** O pacote como o professor o vê. Linha com forma inesperada vira `null` (e um aviso no log). */
  private paraProfessor(linha: Exp02ef1bPacote) {
    const conteudo = lerConteudo(linha.conteudoJson);
    if (!conteudo || !ehDe(DISCIPLINAS, linha.disciplina)) {
      logger.warn({ codigo: "exp02ef1b-pacote-invalido", escolaId: linha.escolaId, turmaId: linha.turmaId }, "pacote com forma inesperada");
      return null;
    }
    return {
      id: linha.id,
      disciplina: linha.disciplina,
      tema: linha.tema,
      palavras: linha.palavras,
      nota: linha.nota,
      chaveDaCena: linha.chaveCena as ChaveDeCena,
      origem: (linha.origem === "ia" ? "ia" : "padrao") as Origem,
      conteudo,
      aprovadoEm: linha.aprovadoEm?.toISOString() ?? null,
      ativo: linha.ativo,
      rodadaAtual: linha.rodadaAtual,
      pendencias: linha.aprovadoEm ? [] : problemasDoConteudo(conteudo, { exigirAlvos: true }),
    };
  }

  private exigirParaProfessor(linha: Exp02ef1bPacote) {
    const pacote = this.paraProfessor(linha);
    if (!pacote) throw new Error("o pacote gravado não voltou legível");
    return pacote;
  }
}
