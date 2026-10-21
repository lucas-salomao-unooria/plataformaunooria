"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

import type { ConversaResumo } from "@/lib/agente-professor/contrato";
import { CONVERSA_NOVA, reduzirConversa, type EstadoDaConversa } from "@/lib/agente-professor/conversa";
import {
  apagarConversa,
  criarConversa,
  lerConversa,
  listarConversas,
  transmitirTurno,
} from "@/lib/agente-professor/transporte";

/**
 * O CÉREBRO DO CHAT: a conversa aberta, a lista do histórico e o turno no ar.
 * A lógica que dá para testar sem navegador mora em `lib/agente-professor/`
 * (o leitor de SSE, o redutor, o transporte); aqui só se liga uma coisa à
 * outra e se guarda o `AbortController` do turno.
 *
 * **Quem aborta o turno, e quem não aborta (decisão):**
 *
 *   - **"Parar"** aborta, e a resposta fica com o que chegou (`interrompida`).
 *   - **Fechar o painel NÃO aborta.** O painel só se esconde (o `ChatPanel`
 *     fica montado com `hidden`); o turno continua, e quando ele termina com o
 *     painel fechado o selo do botão conta a resposta nova. O professor fecha
 *     para olhar a tela de trás — perder a resposta que já estava pagando
 *     (a quota é debitada mesmo no abort) seria castigá-lo por isso.
 *   - **Trocar de conversa ou começar uma nova** aborta e DESCARTA: o estado da
 *     tela passa a ser o de outra conversa, e um evento atrasado da antiga
 *     cairia nela.
 *   - **Desmontar** aborta. O layout do professor remonta o chat ao trocar de
 *     escola (`key` pela escola ativa, ADR-85) e o desmonta ao sair da área: um
 *     turno da escola de antes não pode continuar escrevendo na tela da nova.
 */
/* `use` no nome não é anglicismo de gosto: é o prefixo que o React (e o
   `react-hooks/rules-of-hooks`) exige para reconhecer um hook. */
export function useAgenteProfessor(opcoes: { aoResponder?: () => void } = {}) {
  const [conversa, despachar] = useReducer(reduzirConversa, CONVERSA_NOVA);
  /** `null` = a lista ainda não foi pedida (o chat só a busca quando abre). */
  const [conversas, setConversas] = useState<ConversaResumo[] | null>(null);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [falhaDaLista, setFalhaDaLista] = useState<string | null>(null);
  /** A conversa antiga que está sendo aberta (`GET /conversas/:id`). */
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [falhaAoAbrir, setFalhaAoAbrir] = useState<{ id: string; mensagem: string } | null>(null);
  /** Aviso passageiro do chat (a exclusão que falhou, a conversa que sumiu). */
  const [aviso, setAviso] = useState<string | null>(null);

  /* O estado mais recente, para os `async` lerem sem fechar sobre um render
     velho. Atualizado no commit; quem muda o estado no meio de um turno (o id
     da conversa recém-criada) escreve aqui também. */
  const estadoRef = useRef<EstadoDaConversa>(conversa);
  useLayoutEffect(() => {
    estadoRef.current = conversa;
  }, [conversa]);
  const controleRef = useRef<AbortController | null>(null);
  const abrindoRef = useRef<string | null>(null);
  const contador = useRef(0);
  const aoResponderRef = useRef(opcoes.aoResponder);
  useLayoutEffect(() => {
    aoResponderRef.current = opcoes.aoResponder;
  }, [opcoes.aoResponder]);

  const novoId = () => `m${(contador.current += 1)}`;

  // Desmontar (troca de escola, saída da área) aborta o turno no ar.
  useEffect(() => () => controleRef.current?.abort(), []);

  /** Aborta o turno no ar e esquece dele: o que ele ainda disser não chega à tela. */
  const descartarTurno = useCallback(() => {
    const controle = controleRef.current;
    controleRef.current = null;
    controle?.abort();
  }, []);

  const tocarNaLista = useCallback((id: string, mudar: (c: ConversaResumo) => ConversaResumo) => {
    setConversas((lista) => {
      if (!lista) return lista;
      const alvo = lista.find((c) => c.id === id);
      if (!alvo) return lista;
      // A conversa que acabou de mudar sobe para o topo, como a api ordena.
      return [mudar(alvo), ...lista.filter((c) => c.id !== id)];
    });
  }, []);

  const executarTurno = useCallback(
    async (texto: string) => {
      const controle = new AbortController();
      controleRef.current = controle;
      const vale = () => controleRef.current === controle;

      let conversaId = estadoRef.current.conversaId;
      if (!conversaId) {
        // Primeira mensagem de conversa nova: `POST /conversas` → id → o turno.
        const criada = await criarConversa();
        if (!vale()) return;
        if (!criada.ok) {
          despachar({ tipo: "recusada", erro: criada.recusa.mensagem, podeRepetir: criada.recusa.podeRepetir });
          controleRef.current = null;
          return;
        }
        // Criada, ela é do professor mesmo que ele tenha apertado "Parar" no meio.
        conversaId = criada.valor;
        despachar({ tipo: "criada", conversaId });
        estadoRef.current = { ...estadoRef.current, conversaId };
        const agora = new Date().toISOString();
        const nova: ConversaResumo = { id: conversaId, titulo: null, criadaEm: agora, atualizadaEm: agora };
        setConversas((lista) => (lista ? [nova, ...lista] : lista));
        if (controle.signal.aborted) {
          despachar({ tipo: "interrompida" });
          controleRef.current = null;
          return;
        }
      }

      const id = conversaId;
      const desfecho = await transmitirTurno({
        conversaId: id,
        texto,
        signal: controle.signal,
        aoEvento: (evento) => {
          if (!vale()) return;
          despachar({ tipo: "evento", evento });
          if (evento.tipo === "titulo") tocarNaLista(id, (c) => ({ ...c, titulo: evento.titulo }));
        },
      });
      if (!vale()) return;
      controleRef.current = null;

      switch (desfecho.tipo) {
        case "recusado":
          despachar({ tipo: "recusada", erro: desfecho.recusa.mensagem, podeRepetir: desfecho.recusa.podeRepetir });
          if (desfecho.recusa.status === 404) {
            // A conversa sumiu (expirou no agente, ou foi apagada em outra aba).
            setConversas((lista) => lista?.filter((c) => c.id !== id) ?? lista);
          }
          return;
        case "interrompido":
          despachar({ tipo: "interrompida" });
          break;
        case "caiu":
          despachar({ tipo: "caiu" });
          break;
        case "terminou":
          if (desfecho.evento === "fim") aoResponderRef.current?.();
          break;
      }
      tocarNaLista(id, (c) => ({ ...c, atualizadaEm: new Date().toISOString() }));
    },
    [tocarNaLista],
  );

  const enviar = useCallback(
    (texto: string) => {
      if (estadoRef.current.transmitindo || abrindoRef.current) return;
      setFalhaAoAbrir(null);
      despachar({ tipo: "enviada", idDaPergunta: novoId(), idDaResposta: novoId(), texto });
      void executarTurno(texto);
    },
    [executarTurno],
  );

  /** "Tentar de novo": reenvia a MESMA pergunta, na mesma resposta. */
  const repetir = useCallback(
    (idDaResposta: string) => {
      if (estadoRef.current.transmitindo) return;
      const resposta = estadoRef.current.mensagens.find((m) => m.id === idDaResposta);
      if (!resposta?.pergunta) return;
      despachar({ tipo: "repetida", idDaResposta });
      void executarTurno(resposta.pergunta);
    },
    [executarTurno],
  );

  const parar = useCallback(() => controleRef.current?.abort(), []);

  const carregarLista = useCallback(async () => {
    setCarregandoLista(true);
    const lista = await listarConversas();
    setCarregandoLista(false);
    if (lista.ok) {
      setConversas(lista.valor);
      setFalhaDaLista(null);
    } else {
      setConversas((atual) => atual ?? []);
      setFalhaDaLista(lista.recusa.mensagem);
    }
  }, []);

  const novaConversa = useCallback(() => {
    descartarTurno();
    abrindoRef.current = null;
    setAbrindo(null);
    setFalhaAoAbrir(null);
    despachar({ tipo: "nova" });
  }, [descartarTurno]);

  const abrirConversa = useCallback(
    async (id: string) => {
      if (id === estadoRef.current.conversaId) return;
      descartarTurno();
      abrindoRef.current = id;
      setAbrindo(id);
      setFalhaAoAbrir(null);
      despachar({ tipo: "nova" });
      const lida = await lerConversa(id);
      if (abrindoRef.current !== id) return; // outra conversa foi pedida no meio
      abrindoRef.current = null;
      setAbrindo(null);
      if (lida.ok) {
        despachar({ tipo: "carregada", conversa: lida.valor, ids: lida.valor.mensagens.map(() => novoId()) });
        return;
      }
      if (lida.recusa.status === 404) {
        setConversas((lista) => lista?.filter((c) => c.id !== id) ?? lista);
        setAviso("Esta conversa não existe mais.");
        return;
      }
      setFalhaAoAbrir({ id, mensagem: lida.recusa.mensagem });
    },
    [descartarTurno],
  );

  const apagar = useCallback(
    async (id: string) => {
      const apagada = await apagarConversa(id);
      // 404: já não existia — para quem pediu para apagar, é o mesmo desfecho.
      if (!apagada.ok && apagada.recusa.status !== 404) {
        setAviso("Não foi possível excluir a conversa. Tente de novo.");
        return;
      }
      setConversas((lista) => lista?.filter((c) => c.id !== id) ?? lista);
      if (estadoRef.current.conversaId === id || abrindoRef.current === id) novaConversa();
    },
    [novaConversa],
  );

  return {
    conversa,
    conversas,
    carregandoLista,
    falhaDaLista,
    abrindo,
    falhaAoAbrir,
    aviso,
    fecharAviso: () => setAviso(null),
    enviar,
    repetir,
    parar,
    carregarLista,
    novaConversa,
    abrirConversa,
    apagar,
  };
}
