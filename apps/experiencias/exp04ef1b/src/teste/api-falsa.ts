import type {
  Bloco,
  EdicaoComResultado,
  EdicaoDoEstudante,
  Estado,
  Etapa,
  GatePublico,
  IdDeBloco,
  IdDeNoticia,
  Motivo,
  NoticiaPublica,
  Passo,
  PistaAberta,
  Sessao,
  TipoDePista,
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
const ISCAS_DE_TESTE: readonly IdDeBloco[] = ["foto", "urgencia", "compartilhada"];

/** A bandeja desta sessão, já "embaralhada" — a ordem que a api devolveria. */
/**
 * Os rótulos como o catálogo da api os manda: caixa NORMAL e sem emoji nos seis
 * (a caixa alta é do CSS do `PuzzleBlock`; escrito "FONTE", o leitor de tela
 * soletraria).
 */
export const BLOCOS_DE_TESTE: Bloco[] = [
  { id: "foto", rotulo: "Foto", legenda: "Tem foto bonita? Chama a atenção de quem vê?" },
  { id: "fonte", rotulo: "Fonte", legenda: "De onde veio? É canal oficial ou confiável?" },
  { id: "urgencia", rotulo: "Urgência", legenda: "Diz que é urgente? Pede pressa para espalhar?" },
  { id: "data", rotulo: "Data", legenda: "Quando aconteceu? É de hoje ou do passado?" },
  { id: "compartilhada", rotulo: "Compartilhada", legenda: "Muita gente já mandou? Está em todos os grupos?" },
  { id: "autoria", rotulo: "Autoria", legenda: "Quem assina? Alguém se responsabiliza pelo texto?" },
];

export const BOATO_DE_TESTE = "URGENTE: boato de teste sobre o corte de água. Repassem para todo mundo!";
export const DETALHE_DE_TESTE = "Mensagem sem link oficial, sem data e sem autoridade.";

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
  chaveFormada = false;
  tentativas = 0;
  /** O número de tentativa que cada envio da Chave levou (`undefined` = sem número). */
  readonly numerosDaChave: (number | undefined)[] = [];
  pistas: PistaAberta[] = [];
  iniciadaEm = "2026-09-27T11:00:00.000Z";
  concluidaEm: string | null = null;
  respostas: Record<string, string> = {};
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
      chaveFormada: this.chaveFormada,
      chaveTentativas: this.tentativas,
      edicao2: this.edicao2,
      pistasAbertas: [...this.pistas],
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
        if (!this.chaveFormada || !this.edicao1) throw erro("GET", caminho, 409);
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
      case "/evidencias/exp04ef1b/perguntas/p1":
        this.exigirPasso("GET", caminho, "transferencia", "fim");
        return {
          enunciado: `${BOATO_DE_TESTE}\n\n${DETALHE_DE_TESTE}\n\nO que você precisa conferir antes de repassar?`,
          alternativas: [
            { id: "p1b", texto: "Quantos colegas já receberam." },
            { id: "p1a", texto: "Se veio de canal oficial, com data e assinatura." },
            { id: "p1c", texto: "Se tem a palavra URGENTE." },
          ],
        };
      case "/evidencias/exp04ef1b/perguntas/p2":
        this.exigirPasso("GET", caminho, "transferencia", "fim");
        return {
          enunciado: "O que acontece quando as pessoas repassam sem conferir?",
          alternativas: [
            { id: "p2a", texto: "Pode fazer a escola inteira parar." },
            { id: "p2c", texto: "O celular apaga as mensagens." },
          ],
        };
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
        } else if (c.para === "transferencia") {
          if (this.passo === "comparativo") this.passo = "transferencia";
          else if (this.passo !== "transferencia" && this.passo !== "fim") throw erro("POST", caminho, 409);
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
        this.exigirPasso("POST", caminho, "chave");
        const blocos = c.blocos as IdDeBloco[];
        const numero = typeof c.tentativa === "number" ? c.tentativa : undefined;
        this.numerosDaChave.push(numero);
        const devolvidos = blocos.filter((b) => ISCAS_DE_TESTE.includes(b));
        // A repetição com número já contado não soma (o contrato do `ChaveSchema.tentativa`).
        if (numero !== undefined && numero <= this.tentativas) {
          return { sucesso: false, tentativas: this.tentativas, devolvidos, estado: this.estado() };
        }
        this.tentativas += 1;
        const sucesso = devolvidos.length === 0 && blocos.length === 3;
        if (sucesso) {
          this.chaveFormada = true;
          this.passo = "revisao";
        }
        return { sucesso, tentativas: this.tentativas, devolvidos, estado: this.estado() };
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
      case "/jornal-escola/concluir":
        this.exigirPasso("POST", caminho, "transferencia", "fim");
        this.passo = "fim";
        this.concluidaEm = "2026-09-27T11:50:00.000Z";
        return this.estado();
      case "/evidencias/exp04ef1b/perguntas/p1/resposta":
      case "/evidencias/exp04ef1b/perguntas/p2/resposta": {
        const id = caminho.includes("/p1/") ? "p1" : "p2";
        this.respostas[id] ??= String(c.alternativaId);
        return { enviada: true };
      }
      default:
        throw erro("POST", caminho, 404);
    }
  }
}
