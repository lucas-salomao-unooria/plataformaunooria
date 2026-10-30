/**
 * SÓ EM DESENVOLVIMENTO — uma api FALSA em memória para ver as telas sem o hub
 * nem a api (`?fixture=<nome>` no Vite; `bootstrap.tsx`). Nunca entra no
 * bundle: o único import é dinâmico, atrás de `import.meta.env.DEV`
 * (`contrato.test.ts` confere o `dist/`).
 *
 * O conteúdo vem do catálogo da api (`conteudo.ts`, puro, sem Nest), não de
 * uma cópia: a tela de desenvolvimento mostra o banco padrão como ele é. A
 * derivação do passo repete a de `regras/passos.ts` da api, em miniatura.
 *
 * Fixtures: `espera`, `abertura`, `dados`, `compositor`, `feed0`, `feed80`,
 * `pausa`, `errata`, `errata-recente` (publica depois da retomada, decisão 7),
 * `laudo`, `pericia`, `concluida`. Para mexer no gate pelo console:
 * `__portaVoz.gate("pausa" | "liberada")`.
 */
import type { ExperienciaHandle } from "@edu/sdk";
import {
  CONCLUSAO,
  LAUDO,
  PERICIA,
  RIVAL,
  SERIE_HISTORICA,
  TEXTOS_DO_CHAT,
  TEXTO_DA_PROJECAO,
  conteudoDoPadrao,
  nomeDoGrupo,
} from "../../../../api/src/porta-voz-dos-dados/conteudo";
import { ordemDasCamadas } from "../../../../api/src/porta-voz-dos-dados/regras/publicacao";
import type { EtapaDoGate, Marco, Parecer, Passo, Publicacao, Publicar, Sessao } from "./tipos";

interface Servidor {
  preparada: boolean;
  etapa: EtapaDoGate;
  chat: boolean;
  anexo: boolean;
  nudge: boolean;
  compositor: boolean;
  inicial: Publicacao | null;
  errata: Publicacao | null;
  errataPulada: boolean;
  pericia: boolean;
  parecer: (Parecer & { pulou: boolean }) | null;
}

const minutosAtras = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const pub = (p: Publicar, m = 3): Publicacao => ({ ...p, publicadaEm: minutosAtras(m) });

const BASE: Servidor = {
  preparada: true,
  etapa: "exploracao",
  chat: false,
  anexo: false,
  nudge: false,
  compositor: false,
  inicial: null,
  errata: null,
  errataPulada: false,
  pericia: false,
  parecer: null,
};
const OITENTA_NU: Publicar = { escala: 80, explicacao: false, fonte: false, contexto: false, projecao: false };

const FIXTURES: Record<string, Partial<Servidor>> = {
  espera: { preparada: false },
  abertura: {},
  dados: { chat: true },
  compositor: { chat: true, anexo: true, compositor: true },
  feed0: { chat: true, compositor: true, inicial: pub({ escala: 0, explicacao: true, fonte: true, contexto: false, projecao: false }) },
  feed80: { chat: true, compositor: true, inicial: pub(OITENTA_NU) },
  pausa: { chat: true, compositor: true, inicial: pub(OITENTA_NU), etapa: "pausa" },
  errata: { chat: true, compositor: true, inicial: pub(OITENTA_NU), etapa: "liberada" },
  "errata-recente": { chat: true, anexo: true, compositor: true, etapa: "liberada" },
  laudo: { chat: true, compositor: true, inicial: pub(OITENTA_NU, 8), errata: pub({ escala: 0, explicacao: true, fonte: true, contexto: true, projecao: false }), etapa: "liberada" },
  pericia: { chat: true, compositor: true, inicial: pub(OITENTA_NU, 8), errataPulada: true, etapa: "liberada", pericia: true },
  concluida: {
    chat: true,
    compositor: true,
    inicial: pub(OITENTA_NU, 8),
    errataPulada: true,
    etapa: "liberada",
    pericia: true,
    parecer: { pulou: false, sinalizouA: false, motivoA: null, sinalizouB: true, motivoB: "escala" },
  },
};

function passoDe(s: Servidor): Passo {
  if (s.parecer) return "concluida";
  if (s.pericia) return "pericia";
  if (s.errata || s.errataPulada) return "laudo";
  if (s.inicial) return s.etapa === "liberada" ? "errata" : "feed";
  if (s.compositor) return "compositor";
  if (s.chat) return "dados";
  return "abertura";
}

function sessaoDe(s: Servidor): Sessao {
  const c = conteudoDoPadrao();
  const passo = passoDe(s);
  const slots = 3 - (s.inicial ? 1 : 0) - (s.errata ? 1 : 0);
  return {
    preparada: s.preparada,
    atividade: s.preparada ? { pacoteId: "00000000-0000-0000-0000-000000000000", rodada: 1 } : null,
    etapaDaTurma: s.preparada ? s.etapa : null,
    passo,
    pausada: s.etapa === "pausa" && passo !== "concluida",
    slotsRestantes: slots,
    marcos: { chatAberto: s.chat, anexoAberto: s.anexo, nudgeE2: s.nudge, compositorAberto: s.compositor, periciaAberta: s.pericia },
    publicacoes: { inicial: s.inicial, errata: s.errata, errataPulada: s.errataPulada },
    errataLiberada: Boolean(s.inicial) && !s.errata && !s.errataPulada && s.etapa === "liberada",
    feed: s.inicial
      ? {
          reacoes: s.inicial.escala === 0 ? c.reacoes.zero : c.reacoes.oitenta,
          rival: { escola: RIVAL.escola, escala: s.inicial.escala === 0 ? 80 : 0, chip: RIVAL.chip },
          conflito: c.posAha.conflito,
          coordenador: c.posAha.coordenador,
        }
      : null,
    pericia: s.parecer ? { ...s.parecer, decididaEm: minutosAtras(0) } : null,
    concluido: Boolean(s.parecer),
    conteudo: s.preparada
      ? {
          grupo: { nome: nomeDoGrupo(c.grupo), recorte: c.grupo },
          servico: {
            orgao: c.servico.orgao,
            indicador: c.servico.indicador,
            unidade: c.servico.unidade,
            abrangencia: c.servico.abrangencia,
            periodicidade: c.servico.periodicidade,
            serie: SERIE_HISTORICA.map((v, i) => ({ periodo: c.servico.periodos[i]!, ...v, situacao: c.servico.situacoes[i]! })),
          },
          notaTecnica: c.notaTecnica,
          camadas: { ...c.camadas, projecao: TEXTO_DA_PROJECAO, ordem: ordemDasCamadas("fixture") },
        }
      : null,
    textos: {
      chat: { ...TEXTOS_DO_CHAT, escalas: { ...TEXTOS_DO_CHAT.escalas } },
      laudo: { ...LAUDO, alturas: { origem0: { ...LAUDO.alturas.origem0 }, origem80: { ...LAUDO.alturas.origem80 } }, regua: { ...LAUDO.regua } },
      pericia: {
        ...PERICIA,
        dados: { ...PERICIA.dados, periodos: PERICIA.dados.periodos.map((p) => ({ ...p })) },
        cartoes: PERICIA.cartoes.map((x) => ({ ...x, eixo: { ...x.eixo } })),
        motivos: { ...PERICIA.motivos },
      },
      conclusao: { ...CONCLUSAO },
    },
  };
}

const MARCO: Record<Marco, keyof Servidor> = {
  chat_aberto: "chat",
  anexo_aberto: "anexo",
  nudge_e2: "nudge",
  compositor_aberto: "compositor",
  pericia_aberta: "pericia",
};

export function ligarFixture(nome: string): ExperienciaHandle {
  const s: Servidor = { ...BASE, ...(FIXTURES[nome] ?? {}) };
  const atraso = <T>(v: T) => new Promise<T>((ok) => window.setTimeout(() => ok(v), 250));
  (window as unknown as { __portaVoz: unknown }).__portaVoz = {
    gate: (e: EtapaDoGate) => {
      s.etapa = e;
    },
  };

  const post = (rota: string, corpo?: unknown): Promise<Sessao> => {
    if (s.etapa === "pausa" && passoDe(s) !== "concluida") return Promise.reject(new Error(`API POST ${rota} → 409`));
    const r = rota.replace("/porta-voz-dos-dados/", "");
    if (r === "sessao/marco") {
      const chave = MARCO[(corpo as { marco: Marco }).marco];
      (s as unknown as Record<string, boolean>)[chave] = true;
      if (chave === "compositor") s.chat = true;
    } else if (r === "decisao/publicar") {
      s.inicial = pub(corpo as Publicar, 0);
      s.compositor = true;
    } else if (r === "errata/publicar") s.errata = pub(corpo as Publicar, 0);
    else if (r === "errata/pular") s.errataPulada = true;
    else if (r === "pericia/parecer") s.parecer = { ...(corpo as Parecer), pulou: false };
    else if (r === "pericia/pular") s.parecer = { pulou: true, sinalizouA: false, motivoA: null, sinalizouB: false, motivoB: null };
    return atraso(sessaoDe(s));
  };

  const nada = () => undefined;
  return {
    estudante: { id: "fixture", nome: "Estudante", serie: "3EM", turmaId: "t", escolaId: "e" },
    config: {},
    api: {
      get: <T>() => atraso(sessaoDe(s) as T),
      post: <T>(rota: string, corpo?: unknown) => post(rota, corpo) as Promise<T>,
      put: () => Promise.reject(new Error("sem put")),
      patch: () => Promise.reject(new Error("sem patch")),
      delete: () => Promise.reject(new Error("sem delete")),
    },
    ai: { gerar: () => Promise.reject(new Error("sem ia")) },
    track: nada,
    progresso: { salvar: () => Promise.resolve(), carregar: () => Promise.resolve(null) },
    concluir: nada,
    on: nada,
    enviarEstado: (e) => console.info("[fixture] exp:estado", e),
    reportarErro: (e) => console.error("[fixture] erro", e),
  } as ExperienciaHandle;
}
