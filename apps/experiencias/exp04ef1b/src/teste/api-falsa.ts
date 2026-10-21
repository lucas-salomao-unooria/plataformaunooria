import type {
  BlocoDaChave,
  CorpoDaChave,
  CorpoDaSimulacao,
  CorpoDaTransferencia,
  EdicaoComResultado,
  EdicaoDoEstudante,
  Estado,
  Etapa,
  GatePublico,
  IdDeNoticia,
  JulgamentoGravado,
  Motivo,
  NoticiaPublica,
  Passo,
  PistaAberta,
  Sessao,
  SimulacaoDaTela,
  TipoDePista,
  TransferenciaDaTela,
  Veredito,
} from "../lib/tipos";

/**
 * Uma api FALSA da exp04ef1b, para os testes renderizarem o fluxo inteiro —
 * programada contra o contrato (`apps/api/src/jornal-escola/contrato-de-rotas.ts`
 * e a tabela de rotas do spec), não contra a implementação, que ainda está
 * sendo escrita.
 *
 * **SÓ DE TESTE.** Nenhum arquivo do app importa este: o gabarito abaixo é
 * inventado para o teste e não vai ao bundle (o grep do `dist/` confere).
 *
 * As falhas saem como o SDK as joga — `Error("API POST /x → 409")`, sem corpo.
 */

const PASSOS: readonly Passo[] = [
  "desafio",
  "mesa",
  "motivo",
  "publicada",
  "resultado",
  "chave",
  "revisao",
  "comparativo",
  "simulacao",
  "transferencia",
  "fim",
];
const ETAPAS: readonly Etapa[] = ["exploracao", "resultado", "revisao"];

/** O `passoEfetivo` da api, reescrito aqui (a regra está em `regras/passos.ts`). */
function efetivo(passo: Passo, etapa: Etapa): Passo {
  if (passo === "desafio" || passo === "mesa" || passo === "motivo") return passo;
  if (passo === "publicada" || passo === "resultado" || passo === "chave") {
    return etapa === "exploracao" ? "publicada" : etapa === "resultado" ? "resultado" : "chave";
  }
  return passo;
}

const MEIOS_DA_MESA: NoticiaPublica["meio"][] = ["jornal", "radio", "tv", "blog", "portal", "rede_social", "mensagem", "mural"];

/** As oito notícias da mesa de teste. `n2`, `n3` e `n5` não são publicáveis (o gabarito é só do teste). */
export const NOTICIAS_DE_TESTE: NoticiaPublica[] = MEIOS_DA_MESA.map((meio, i) => {
  const id = `n${i + 1}` as IdDeNoticia;
  return {
    id,
    meio,
    veiculo: `Veículo ${id}`,
    falante: meio === "radio" || meio === "mensagem" ? `Quem fala em ${id}` : null,
    manchete: `Manchete da notícia ${id}`,
    resumo: `Resumo da notícia ${id} com contexto suficiente para a criança investigar o que aconteceu.`,
    corpo: `Corpo da matéria original ${id}.`,
    legenda: meio === "tv" ? `Legenda do quadro ${id}` : null,
    imagem: meio === "tv" || meio === "rede_social" ? { url: null, alt: `Descrição da imagem ${id}` } : null,
  };
});

const PILAR_DE_TESTE: Partial<Record<IdDeNoticia, TipoDePista>> = { n2: "data", n3: "fonte", n5: "autoria" };

/**
 * A bandeja desta sessão, já "embaralhada" — a ordem que a api devolveria —,
 * com os rótulos como o catálogo da api os manda: caixa NORMAL e sem emoji (a
 * caixa alta é do CSS do `PuzzleBlock`; escrito "FONTE", o leitor de tela
 * soletraria). Os cartões também vêm embaralhados: o `indice` é a posição
 * canônica, e a ordem da lista não é ela (a `fonte` mostra o `indice: 1` primeiro).
 */
export const BLOCOS_DE_TESTE: BlocoDaChave[] = [
  {
    id: "foto",
    rotulo: "Foto",
    legenda: "Tem foto bonita? Chama a atenção de quem vê?",
    cartoes: [
      { indice: 0, texto: "Tem foto bonita e colorida", exemplo: "uma foto grande" },
      { indice: 1, texto: "Não tem foto", exemplo: "só o texto" },
    ],
  },
  {
    id: "fonte",
    rotulo: "Fonte",
    legenda: "De onde veio? É canal oficial ou confiável?",
    cartoes: [
      { indice: 1, texto: "Ninguém sabe de onde veio", exemplo: "me mandaram no grupo" },
      { indice: 0, texto: "Veio de um canal oficial ou conhecido", exemplo: "o site da prefeitura" },
    ],
  },
  {
    id: "urgencia",
    rotulo: "Urgência",
    legenda: "Diz que é urgente? Pede pressa para espalhar?",
    cartoes: [
      { indice: 0, texto: "Diz que é URGENTE", exemplo: "corram, repassem já!" },
      { indice: 1, texto: "Fala com calma", exemplo: "sem pressa" },
    ],
  },
  {
    id: "data",
    rotulo: "Data",
    legenda: "Quando aconteceu? É de hoje ou do passado?",
    cartoes: [
      { indice: 0, texto: "Aconteceu agora ou vai acontecer", exemplo: "publicado ontem" },
      { indice: 1, texto: "É de muito tempo atrás", exemplo: "em 2018" },
    ],
  },
  {
    id: "compartilhada",
    rotulo: "Compartilhada",
    legenda: "Muita gente já mandou? Está em todos os grupos?",
    cartoes: [
      { indice: 0, texto: "Todo mundo já mandou", exemplo: "está em todos os grupos" },
      { indice: 1, texto: "Pouca gente mandou", exemplo: "chegou para poucos" },
    ],
  },
  {
    id: "autoria",
    rotulo: "Autoria",
    legenda: "Quem assina? Alguém se responsabiliza pelo texto?",
    cartoes: [
      { indice: 1, texto: "Ninguém assina o texto", exemplo: "sem nome no fim" },
      { indice: 0, texto: "Tem o nome de quem escreveu", exemplo: "por Marta Ribeiro" },
    ],
  },
];

/** As frases de pulo da isca, como o catálogo da api as manda. */
const PULO_DE_TESTE: Record<string, string> = {
  foto: "Esta matéria não tem foto. Siga para o próximo passo.",
  urgencia: "Esta matéria não diz se é urgente. Siga para o próximo passo.",
  compartilhada: "Não dá para saber quanta gente mandou esta matéria. Siga para o próximo passo.",
};

export const REFERENCIA_DE_TESTE = "Bons editores olham a fonte, a data e a autoria em todas as notícias.";

export const MATERIAS_DE_TESTE: SimulacaoDaTela["materias"] = [
  {
    id: "s1",
    meio: "jornal",
    veiculo: "Jornal do Bairro",
    falante: null,
    manchete: "Manchete da matéria s1",
    resumo: "Resumo da matéria s1 da simulação, com contexto para a criança testar a Chave.",
    pistas: { fonte: "Pista de fonte da s1", data: "Pista de data da s1", autoria: "Pista de autoria da s1" },
  },
  {
    id: "s2",
    meio: "blog",
    veiculo: "Blog Novidades",
    falante: null,
    manchete: "Manchete da matéria s2",
    resumo: "Resumo da matéria s2 da simulação, com contexto para a criança testar a Chave.",
    pistas: { fonte: "Pista de fonte da s2", data: "Pista de data da s2", autoria: "Pista de autoria da s2" },
  },
];

export const BOATO_DE_TESTE: TransferenciaDaTela = {
  remetente: "Grupo da turma",
  mensagem: "URGENTE: boato de teste sobre o corte de água. Repassem para todo mundo!",
  pistas: {
    fonte: "Pista de fonte do boato",
    data: "Pista de data do boato",
    autoria: "Pista de autoria do boato",
  },
};

function erro(metodo: string, caminho: string, status: number): Error {
  return new Error(`API ${metodo} ${caminho} → ${status}`);
}

export class RedacaoFalsa {
  sessaoId = "11111111-1111-4111-8111-111111111111";
  pacoteId = "22222222-2222-4222-8222-222222222222";
  rodada = 1;
  etapa: Etapa = "exploracao";
  passo: Passo = "desafio";
  edicao1: EdicaoDoEstudante | null = null;
  edicao2: EdicaoDoEstudante | null = null;
  motivo: Motivo | null = null;
  /** A Chave montada como a api a gravou (o corpo do primeiro envio). */
  chave: CorpoDaChave | null = null;
  /** Quantos `POST chave` chegaram (o reenvio idêntico também conta aqui). */
  enviosDaChave = 0;
  pistas: PistaAberta[] = [];
  julgamentos: JulgamentoGravado[] = [];
  simulacao: CorpoDaSimulacao | null = null;
  transferencia: CorpoDaTransferencia | null = null;
  iniciadaEm = "2026-09-27T11:00:00.000Z";
  concluidaEm: string | null = null;
  /** Cada chamada, como "GET /jornal-escola/gate". */
  readonly chamadas: string[] = [];

  private estado(): Estado {
    const passo = efetivo(this.passo, this.etapa);
    return {
      sessaoId: this.sessaoId,
      pacoteId: this.pacoteId,
      rodada: this.rodada,
      etapa: this.etapa,
      passo,
      passoDoEstudante: this.passo,
      aguardandoOProfessor: passo === "publicada" || passo === "resultado",
      edicao1: this.edicao1,
      motivoRespondido: this.motivo !== null,
      chaveFormada: this.chave !== null,
      edicao2: this.edicao2,
      pistasAbertas: [...this.pistas],
      julgamentos: [...this.julgamentos],
      simulada: this.simulacao !== null,
      transferida: this.transferencia !== null,
      iniciadaEm: this.iniciadaEm,
      concluidaEm: this.concluidaEm,
    };
  }

  private sessao(): Sessao {
    const estado = this.estado();
    const depoisDaChave = PASSOS.indexOf(estado.passo) >= PASSOS.indexOf("chave");
    return {
      ...estado,
      pacote: { tema: "Feira de Ciências", noticias: NOTICIAS_DE_TESTE },
      blocos: depoisDaChave ? BLOCOS_DE_TESTE : null,
      limites: { edicao: 3, chave: 3 },
    };
  }

  private comResultado(edicao: EdicaoDoEstudante): EdicaoComResultado {
    const verificadas = edicao.slots.filter((id) => !PILAR_DE_TESTE[id]).length;
    return {
      slots: edicao.slots,
      layout: edicao.layout,
      verificadas,
      percentual: [0, 33, 67, 100][verificadas] ?? 0,
      reacoes: edicao.slots.map((id) => ({
        noticiaId: id,
        leitor: PILAR_DE_TESTE[id] ? `Leitor preocupado com ${id}` : `Leitor contente com ${id}`,
        fala: PILAR_DE_TESTE[id] ? `Fala de quem se atrapalhou com ${id}.` : `Fala de quem aproveitou ${id}.`,
        humor: PILAR_DE_TESTE[id] ? ("upset" as const) : ("happy" as const),
      })),
    };
  }

  private exigirPasso(metodo: string, caminho: string, ...passos: Passo[]) {
    if (!passos.includes(efetivo(this.passo, this.etapa))) throw erro(metodo, caminho, 409);
  }

  /** O professor aperta o botão único do painel. */
  liberar(para: Etapa) {
    if (ETAPAS.indexOf(para) !== ETAPAS.indexOf(this.etapa) + 1) throw new Error("transição inválida no teste");
    this.etapa = para;
  }

  async get(caminho: string): Promise<unknown> {
    this.chamadas.push(`GET ${caminho}`);
    await Promise.resolve();
    switch (caminho) {
      case "/jornal-escola/sessao":
        return this.sessao();
      case "/jornal-escola/gate": {
        const e = this.estado();
        const gate: GatePublico = {
          etapa: this.etapa,
          rodada: this.rodada,
          pacoteId: this.pacoteId,
          passoEfetivo: e.passo,
          aguardandoOProfessor: e.aguardandoOProfessor,
          agora: "2026-09-27T11:00:00.000Z",
        };
        return gate;
      }
      case "/jornal-escola/resultado":
        if (!this.edicao1) throw erro("GET", caminho, 409);
        if (this.etapa === "exploracao") throw erro("GET", caminho, 409);
        return { edicao1: this.comResultado(this.edicao1) };
      case "/jornal-escola/revisao":
        if (!this.chave || !this.edicao1) throw erro("GET", caminho, 409);
        return { vagas: this.edicao1.slots.map((id) => ({ noticiaId: id, pilarEmFalta: PILAR_DE_TESTE[id] ?? null })) };
      case "/jornal-escola/comparativo": {
        if (!this.edicao1 || !this.edicao2) throw erro("GET", caminho, 409);
        const ids = [...new Set([...this.edicao1.slots, ...this.edicao2.slots])];
        return {
          edicao1: this.comResultado(this.edicao1),
          edicao2: this.comResultado(this.edicao2),
          vagas: ids.map((id) => ({ noticiaId: id, pilarEmFalta: PILAR_DE_TESTE[id] ?? null })),
        };
      }
      case "/jornal-escola/simulacao": {
        this.exigirPasso("GET", caminho, "simulacao", "transferencia");
        const chave = this.chave;
        if (!chave) throw erro("GET", caminho, 409);
        const tela: SimulacaoDaTela = {
          materias: MATERIAS_DE_TESTE,
          chave: {
            vagas: chave.vagas.map((v) => ({
              bloco: v.bloco,
              rotulo: BLOCOS_DE_TESTE.find((b) => b.id === v.bloco)?.rotulo ?? v.bloco,
              seFalhar: v.seFalhar,
              pulo: PULO_DE_TESTE[v.bloco] ?? null,
            })),
            repeticao: chave.repeticao,
          },
        };
        return tela;
      }
      case "/jornal-escola/transferencia":
        this.exigirPasso("GET", caminho, "transferencia", "fim");
        return BOATO_DE_TESTE;
      default:
        throw erro("GET", caminho, 404);
    }
  }

  async post(caminho: string, corpo?: unknown): Promise<unknown> {
    this.chamadas.push(`POST ${caminho}`);
    await Promise.resolve();
    const c = (corpo ?? {}) as Record<string, unknown>;
    switch (caminho) {
      case "/jornal-escola/passo": {
        if (c.para === "mesa") {
          if (this.passo === "desafio") this.passo = "mesa";
        } else if (c.para === "simulacao") {
          if (this.passo === "comparativo") this.passo = this.chave ? "simulacao" : "transferencia";
          else if (this.passo !== "simulacao" && this.passo !== "transferencia" && this.passo !== "fim") {
            throw erro("POST", caminho, 409);
          }
        }
        return this.estado();
      }
      case "/jornal-escola/pista": {
        this.exigirPasso("POST", caminho, "mesa", "revisao");
        const noticiaId = c.noticiaId as IdDeNoticia;
        const tipo = c.tipo as TipoDePista;
        const fase = efetivo(this.passo, this.etapa) === "mesa" ? 1 : 2;
        const texto = `Pista de ${tipo} da notícia ${noticiaId}`;
        // Idempotente por par NA MESMA FASE (`regras/pistas.ts`); o mesmo par entra de novo na fase 2.
        if (!this.pistas.some((p) => p.noticiaId === noticiaId && p.tipo === tipo && p.fase === fase)) {
          this.pistas.push({ noticiaId, tipo, fase, texto });
        }
        const abertas = new Set(this.pistas.map((p) => `${p.noticiaId}:${p.tipo}`)).size;
        return { noticiaId, tipo, fase, texto, abertas };
      }
      case "/jornal-escola/julgamento": {
        // Só na mesa da 1ª edição, só de pista aberta, e o PRIMEIRO vale (`regras/julgamentos.ts`).
        this.exigirPasso("POST", caminho, "mesa");
        const noticiaId = c.noticiaId as IdDeNoticia;
        const tipo = c.tipo as TipoDePista;
        if (!this.pistas.some((p) => p.noticiaId === noticiaId && p.tipo === tipo && p.fase === 1)) {
          throw erro("POST", caminho, 409);
        }
        const gravado = this.julgamentos.find((j) => j.noticiaId === noticiaId && j.tipo === tipo);
        if (gravado) return { ...gravado, novo: false };
        const novo = { noticiaId, tipo, veredito: c.veredito as Veredito };
        this.julgamentos.push(novo);
        return { ...novo, novo: true };
      }
      case "/jornal-escola/diagramar":
        this.exigirPasso("POST", caminho, "mesa", "revisao");
        return { layout: "columns", origem: "modelo" };
      case "/jornal-escola/publicar": {
        this.exigirPasso("POST", caminho, "mesa");
        if (this.edicao1) throw erro("POST", caminho, 409);
        this.edicao1 = {
          slots: c.slots as IdDeNoticia[],
          layout: c.layout as EdicaoDoEstudante["layout"],
          origemDoLayout: c.origemDoLayout as EdicaoDoEstudante["origemDoLayout"],
          publicadaEm: "2026-09-27T11:10:00.000Z",
        };
        this.passo = "motivo";
        return this.estado();
      }
      case "/jornal-escola/motivo":
        this.exigirPasso("POST", caminho, "motivo");
        this.motivo = c.motivo as Motivo;
        this.passo = "publicada";
        return this.estado();
      case "/jornal-escola/chave": {
        // Um envio, SEM correção: o reenvio idêntico devolve o estado; outro, 409.
        this.exigirPasso("POST", caminho, "chave", "revisao");
        this.enviosDaChave += 1;
        const corpo = c as unknown as CorpoDaChave;
        if (this.chave) {
          if (JSON.stringify(this.chave) !== JSON.stringify(corpo)) throw erro("POST", caminho, 409);
          return { estado: this.estado() };
        }
        if (this.etapa !== "revisao") throw erro("POST", caminho, 409);
        this.chave = corpo;
        this.passo = "revisao";
        return { estado: this.estado() };
      }
      case "/jornal-escola/republicar": {
        this.exigirPasso("POST", caminho, "revisao");
        if (this.edicao2) throw erro("POST", caminho, 409);
        this.edicao2 = {
          slots: c.slots as IdDeNoticia[],
          layout: c.layout as EdicaoDoEstudante["layout"],
          origemDoLayout: c.origemDoLayout as EdicaoDoEstudante["origemDoLayout"],
          publicadaEm: "2026-09-27T11:40:00.000Z",
        };
        this.passo = "comparativo";
        return this.estado();
      }
      case "/jornal-escola/simulacao": {
        this.exigirPasso("POST", caminho, "simulacao");
        if (this.simulacao) throw erro("POST", caminho, 409);
        this.simulacao = c as unknown as CorpoDaSimulacao;
        this.passo = "transferencia";
        return { estado: this.estado(), referencia: REFERENCIA_DE_TESTE };
      }
      case "/jornal-escola/transferencia": {
        this.exigirPasso("POST", caminho, "transferencia");
        if (this.transferencia) throw erro("POST", caminho, 409);
        this.transferencia = c as unknown as CorpoDaTransferencia;
        return { estado: this.estado() };
      }
      case "/jornal-escola/concluir":
        this.exigirPasso("POST", caminho, "transferencia", "fim");
        if (!this.transferencia) throw erro("POST", caminho, 409);
        this.passo = "fim";
        this.concluidaEm = "2026-09-27T11:50:00.000Z";
        return this.estado();
      default:
        throw erro("POST", caminho, 404);
    }
  }
}
