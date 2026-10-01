import type { Conversa, EventoDoTurno, Fonte } from "./contrato";

/**
 * O ESTADO DA CONVERSA na tela do agente de IA do professor — um redutor puro,
 * para o teste poder conduzir um turno inteiro (deltas, fontes, título, aviso,
 * fim, erro, "Parar") sem navegador.
 *
 * Os quatro estados de uma resposta são os do `ChatMessage` do DS:
 * `enviando` (antes do primeiro trecho: o indicador de escrita), `transmitindo`
 * (o texto cresce), `pronta` e `erro`. "Parar" NÃO é erro: a resposta fica
 * `pronta` com o que chegou e um rótulo de interrompida.
 */

export type EstadoDaMensagem = "enviando" | "transmitindo" | "pronta" | "erro";

export interface MensagemDaTela {
  id: string;
  autor: "professor" | "agente";
  texto: string;
  estado: EstadoDaMensagem;
  fontes?: Fonte[];
  /** Os `aviso` do turno (um por código de habilidade que não existe). */
  avisos: string[];
  /** O texto do erro, com `estado: "erro"`. */
  erro?: string;
  /** Faz sentido oferecer "Tentar de novo"? Nunca para a quota do dia. */
  podeRepetir?: boolean;
  /** O professor apertou "Parar": a resposta ficou com o que tinha chegado. */
  interrompida?: boolean;
  /** Da resposta do agente: a pergunta que a gerou — é o que "Tentar de novo" reenvia. */
  pergunta?: string;
}

export interface EstadoDaConversa {
  /** `null` = conversa nova, ainda sem `POST /conversas`. */
  conversaId: string | null;
  titulo: string | null;
  mensagens: MensagemDaTela[];
  /** Há um turno no ar (o compositor mostra "Parar"). */
  transmitindo: boolean;
  /** A resposta que está chegando — é nela que os eventos do stream caem. */
  respostaAtual: string | null;
}

export const CONVERSA_NOVA: EstadoDaConversa = {
  conversaId: null,
  titulo: null,
  mensagens: [],
  transmitindo: false,
  respostaAtual: null,
};

/** Como a resposta é interrompida, se não chegou a dizer nada ou se disse parte. */
export const ROTULO_DE_INTERROMPIDA = "Resposta interrompida.";

export type AcaoDaConversa =
  | { tipo: "nova" }
  | { tipo: "carregada"; conversa: Conversa; ids: string[] }
  | { tipo: "criada"; conversaId: string }
  | { tipo: "enviada"; idDaPergunta: string; idDaResposta: string; texto: string }
  | { tipo: "repetida"; idDaResposta: string }
  | { tipo: "evento"; evento: EventoDoTurno }
  | { tipo: "recusada"; erro: string; podeRepetir: boolean }
  | { tipo: "interrompida" }
  | { tipo: "caiu" };

/** A api manda `paginaInicio: null`; o DS quer a página ou nada. */
export function fonteParaTela(fonte: Fonte): { titulo: string; paginaInicio?: number; paginaFim?: number } {
  return {
    titulo: fonte.titulo,
    ...(typeof fonte.paginaInicio === "number" ? { paginaInicio: fonte.paginaInicio } : {}),
    ...(typeof fonte.paginaFim === "number" ? { paginaFim: fonte.paginaFim } : {}),
  };
}

/** O código do evento `erro` (e da recusa 429) que NÃO adianta repetir agora. */
export function codigoPermiteRepetir(codigo: string | undefined): boolean {
  return codigo !== "QUOTA";
}

const MENSAGEM_DE_ERRO_PADRAO = "O agente de IA do professor não respondeu agora. Tente de novo em instantes.";

function naResposta(
  estado: EstadoDaConversa,
  mudar: (m: MensagemDaTela) => MensagemDaTela,
  fimDoTurno = false,
): EstadoDaConversa {
  const alvo = estado.respostaAtual;
  if (!alvo) return estado;
  return {
    ...estado,
    mensagens: estado.mensagens.map((m) => (m.id === alvo ? mudar(m) : m)),
    ...(fimDoTurno ? { transmitindo: false, respostaAtual: null } : {}),
  };
}

export function reduzirConversa(estado: EstadoDaConversa, acao: AcaoDaConversa): EstadoDaConversa {
  switch (acao.tipo) {
    case "nova":
      return CONVERSA_NOVA;

    case "carregada":
      return {
        conversaId: acao.conversa.id,
        titulo: acao.conversa.titulo,
        transmitindo: false,
        respostaAtual: null,
        mensagens: acao.conversa.mensagens.map((m, i) => ({
          id: acao.ids[i] ?? `carregada-${i}`,
          autor: m.autor,
          texto: m.texto,
          estado: "pronta",
          fontes: m.fontes,
          avisos: [],
        })),
      };

    case "criada":
      return { ...estado, conversaId: acao.conversaId };

    case "enviada":
      return {
        ...estado,
        transmitindo: true,
        respostaAtual: acao.idDaResposta,
        mensagens: [
          ...estado.mensagens,
          { id: acao.idDaPergunta, autor: "professor", texto: acao.texto, estado: "pronta", avisos: [] },
          {
            id: acao.idDaResposta,
            autor: "agente",
            texto: "",
            estado: "enviando",
            avisos: [],
            pergunta: acao.texto,
          },
        ],
      };

    case "repetida":
      return {
        ...estado,
        transmitindo: true,
        respostaAtual: acao.idDaResposta,
        mensagens: estado.mensagens.map((m) =>
          m.id === acao.idDaResposta
            ? { id: m.id, autor: m.autor, texto: "", estado: "enviando", avisos: [], pergunta: m.pergunta }
            : m,
        ),
      };

    case "evento": {
      const e = acao.evento;
      switch (e.tipo) {
        case "delta":
          return naResposta(estado, (m) => ({ ...m, texto: m.texto + e.texto, estado: "transmitindo" }));
        case "fontes":
          return naResposta(estado, (m) => ({ ...m, fontes: e.fontes }));
        case "titulo":
          // O título é da CONVERSA, não da mensagem: vale mesmo sem resposta no ar.
          return { ...estado, titulo: e.titulo };
        case "aviso":
          return naResposta(estado, (m) => ({ ...m, avisos: [...m.avisos, e.mensagem] }));
        case "fim":
          return naResposta(estado, (m) => ({ ...m, estado: "pronta" }), true);
        case "erro":
          return naResposta(
            estado,
            (m) => ({
              ...m,
              estado: "erro",
              erro: e.mensagem || MENSAGEM_DE_ERRO_PADRAO,
              podeRepetir: codigoPermiteRepetir(e.codigo),
            }),
            true,
          );
      }
      return estado;
    }

    case "recusada":
      return naResposta(
        estado,
        (m) => ({ ...m, estado: "erro", erro: acao.erro, podeRepetir: acao.podeRepetir }),
        true,
      );

    case "interrompida":
      return naResposta(
        estado,
        (m) => ({ ...m, estado: "pronta", interrompida: true }),
        true,
      );

    case "caiu":
      /* A conexão terminou sem `fim` nem `erro`: o que chegou fica na tela, e a
         mensagem diz que a resposta não terminou — sem isso, um texto cortado
         no meio pareceria uma resposta inteira. */
      return naResposta(
        estado,
        (m) => ({
          ...m,
          estado: "erro",
          erro: "A conexão caiu antes do fim da resposta.",
          podeRepetir: true,
        }),
        true,
      );
  }
}
