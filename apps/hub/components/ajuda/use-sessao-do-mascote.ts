"use client";

import { useCallback, useEffect, useReducer, useRef, useState, type RefObject } from "react";

import { CONVERSA_VAZIA, ESPERA_DA_RESPOSTA_MS, reduzirConversa } from "@/lib/ajuda/conversa";
import { AudioDaFala, Microfone } from "@/lib/ajuda/mascote/audio";
import type { CenaDoMascote } from "@/lib/ajuda/mascote/cena";
import { conectarAoMascote, enderecoDoMascote, ErroDeConexao, fechamentoParaTela, type AoVivo } from "@/lib/ajuda/mascote/conexao";
import { LipSync, VISEMAS } from "@/lib/ajuda/mascote/lipsync";
import { abrirSessao, encerrarSessao } from "@/lib/ajuda/transporte";
import type { EstadoDoMicrofone, Fase, SessaoDaAjuda } from "./use-sessao-da-ajuda";

/**
 * A CONVERSA COM O MASCOTE (ADR-158), do clique em "Ajuda" ao fechar — o mesmo
 * contrato do `useSessaoDaAjuda` (avatar), para a janela montar as duas com as
 * mesmas peças do DS.
 *
 * O caminho: `POST /ajuda/sessoes` (pelo BFF) reserva os minutos e devolve o
 * BILHETE; o navegador abre a conexão de voz direto na api e entra com ele. O
 * mascote 3D carrega em paralelo (o `three` só chega por `import()` quando a
 * janela abre). A boca sai do próprio áudio, a cada quadro.
 *
 * **O microfone começa DESLIGADO**, como no avatar: a permissão só aparece
 * quando a pessoa aperta "Falar". E, sem fone, o microfone fica surdo
 * enquanto o mascote fala — senão ele ouve a si mesmo e se interrompe (medido
 * no PoC).
 *
 * **Uma geração por abertura**: o modo estrito do React monta, desmonta e
 * monta de novo em dev; a abertura que termina depois de a sua geração ter
 * acabado encerra a sessão que acabou de abrir.
 */

export interface SessaoDoMascoteNaTela extends SessaoDaAjuda {
  /** 0 a 1 enquanto o modelo 3D baixa; `null` quando já está na tela (ou falhou). */
  carregandoModelo: number | null;
  /** O modelo 3D não apareceu (sem WebGL, ou não baixou) — a conversa segue sem o rosto. */
  semRosto: boolean;
}

export function useSessaoDoMascote(
  canvas: RefObject<HTMLCanvasElement | null>,
  opcoes: { modeloUrl: string; apiUrl: string },
): SessaoDoMascoteNaTela {
  const [fase, setFase] = useState<Fase>("abrindo");
  const [erro, setErro] = useState<SessaoDaAjuda["erro"]>(null);
  const [conversa, despachar] = useReducer(reduzirConversa, CONVERSA_VAZIA);
  const [microfone, setMicrofone] = useState<EstadoDoMicrofone>("desligado");
  const [atendenteFalando, setAtendenteFalando] = useState(false);
  const [pessoaFalando, setPessoaFalando] = useState(false);
  const [restanteS, setRestanteS] = useState<number | null>(null);
  const [carregandoModelo, setCarregandoModelo] = useState<number | null>(0);
  const [semRosto, setSemRosto] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const conexaoRef = useRef<AoVivo | null>(null);
  const audioRef = useRef<AudioDaFala | null>(null);
  const microfoneRef = useRef<Microfone | null>(null);
  const lipsyncRef = useRef(new LipSync());
  const idRef = useRef<string | null>(null);
  const prazoRef = useRef<number | null>(null);
  const perguntaFaladaRef = useRef("");
  const repousoRef = useRef(0.5);

  const fechar = useCallback(() => {
    conexaoRef.current?.fechar();
    conexaoRef.current = null;
    microfoneRef.current?.desligar();
    if (idRef.current) encerrarSessao(idRef.current);
    idRef.current = null;
  }, []);

  /** A pergunta falada chega em pedaços; vira UMA mensagem quando o mascote começa a responder. */
  const fecharPerguntaFalada = useCallback(() => {
    const texto = perguntaFaladaRef.current.trim();
    perguntaFaladaRef.current = "";
    setPessoaFalando(false);
    if (texto) despachar({ tipo: "pergunta-falada", texto });
  }, []);

  /* A abertura: uma por geração (o `tentativa` é o "Tentar de novo"). */
  useEffect(() => {
    let viva = true;
    setFase("abrindo");
    setErro(null);
    setMicrofone("desligado");
    const audio = new AudioDaFala();
    audioRef.current = audio;
    microfoneRef.current = new Microfone(audio);
    const lipsync = lipsyncRef.current;
    lipsync.zerar();

    const falhar = (mensagem: string, podeRepetir: boolean) => {
      if (!viva) return;
      fechar();
      setErro({ mensagem, podeRepetir });
      setFase("erro");
    };

    void (async () => {
      // O clique em "Ajuda" já ativou a página: o navegador deixa o áudio começar.
      await audio.iniciar().catch(() => undefined);
      const abertura = await abrirSessao("mascote");
      if (!viva) {
        if (abertura.ok) encerrarSessao(abertura.sessao.id);
        return;
      }
      if (!abertura.ok) return falhar(abertura.mensagem, abertura.podeRepetir);
      const sessao = abertura.sessao;
      idRef.current = sessao.id;
      if (sessao.atendente !== "mascote") {
        // A rede não deixa trocar, ou o mascote saiu do ar entre a janela abrir e agora.
        return falhar("A Ajuda com o mascote não está disponível agora.", true);
      }
      lipsync.ajustes = { sensibilidade: sessao.ajustes.sensibilidade, suavizacao: sessao.ajustes.suavizacao };
      audio.definirAntecipacao(sessao.ajustes.antecipacaoMs / 1000);
      repousoRef.current = sessao.ajustes.bocaRepouso;
      setFase("conectando");

      try {
        const { conexao, prazo } = await conectarAoMascote({
          endereco: enderecoDoMascote(opcoes.apiUrl),
          bilhete: sessao.bilhete,
          aoEvento: (evento) => {
            if (!viva) return;
            switch (evento.tipo) {
              case "audio":
                audio.tocarPcm16(evento.base64, evento.taxa);
                break;
              case "transcricao-entrada":
                perguntaFaladaRef.current += evento.texto;
                setPessoaFalando(true);
                break;
              case "transcricao-saida":
                fecharPerguntaFalada();
                despachar({ tipo: "resposta-pedaco", texto: evento.texto });
                break;
              case "interrompido":
                audio.interromper();
                lipsync.zerar();
                despachar({ tipo: "resposta-fim" });
                break;
              case "fim-do-turno":
                fecharPerguntaFalada();
                despachar({ tipo: "resposta-fim" });
                break;
            }
          },
          aoFechar: (codigo) => {
            if (!viva) return;
            const tela = fechamentoParaTela(codigo);
            fechar();
            audio.interromper();
            lipsync.zerar();
            setAtendenteFalando(false);
            setPessoaFalando(false);
            setMicrofone("desligado");
            if (tela.tipo === "encerrada") setFase("encerrada");
            else {
              setErro({ mensagem: tela.mensagem, podeRepetir: tela.podeRepetir });
              setFase("erro");
            }
          },
        });
        if (!viva) {
          conexao.fechar();
          return;
        }
        conexaoRef.current = conexao;
        prazoRef.current = prazo.getTime();
        setRestanteS(Math.max(0, Math.round((prazo.getTime() - Date.now()) / 1000)));
        setFase("conversando");
      } catch (e) {
        const tela = fechamentoParaTela(e instanceof ErroDeConexao ? e.codigo : 1006);
        falhar(tela.mensagem, tela.podeRepetir);
      }
    })();

    return () => {
      viva = false;
      fechar();
      void audio.fechar();
      audioRef.current = null;
    };
  }, [tentativa, fechar, fecharPerguntaFalada, opcoes.apiUrl]);

  /* O mascote na tela: carrega o modelo e anima a boca a cada quadro. */
  useEffect(() => {
    const elemento = canvas.current;
    if (!elemento) return;
    let viva = true;
    let quadro = 0;
    let cena: CenaDoMascote | null = null;
    const aplicados = new Float32Array(VISEMAS.length);
    let presenca = 0;
    let falandoAntes = false;
    let anterior = performance.now();

    const animar = (agora: number) => {
      if (!viva || !cena) return;
      const dt = Math.min(0.1, (agora - anterior) / 1000);
      anterior = agora;
      const audio = audioRef.current;
      const falando = audio?.falando ?? false;
      if (falando !== falandoAntes) {
        falandoAntes = falando;
        setAtendenteFalando(falando);
      }
      const lipsync = lipsyncRef.current;
      const pesos = audio?.analisador ? lipsync.quadro(audio.analisador, dt) : lipsync.pesos;
      // parado, a boca mistura o visema de repouso com o sorriso original do modelo
      const meta = falando ? 1 : 1 - repousoRef.current;
      presenca += (meta - presenca) * (1 - Math.exp(-dt / 0.25));
      for (let i = 0; i < aplicados.length; i++) aplicados[i] = (pesos[i] ?? 0) * presenca;
      cena.definirPesos(aplicados);
      cena.quadro(dt, falando ? lipsync.nivel : 0);
      quadro = requestAnimationFrame(animar);
    };

    setCarregandoModelo(0);
    setSemRosto(false);
    void (async () => {
      try {
        const { CenaDoMascote: Cena } = await import("@/lib/ajuda/mascote/cena");
        if (!viva) return;
        cena = new Cena(elemento);
        await cena.carregar(opcoes.modeloUrl, (f) => {
          if (viva) setCarregandoModelo(f);
        });
        if (!viva) return;
        setCarregandoModelo(null);
        anterior = performance.now();
        quadro = requestAnimationFrame(animar);
      } catch {
        // Sem WebGL, ou o modelo não baixou: a conversa segue sem o rosto.
        if (!viva) return;
        setCarregandoModelo(null);
        setSemRosto(true);
      }
    })();

    return () => {
      viva = false;
      cancelAnimationFrame(quadro);
      cena?.descartar();
    };
  }, [canvas, opcoes.modeloUrl]);

  /* O relógio do teto: a api fecha a conexão sozinha; aqui é só para a pessoa ver. */
  useEffect(() => {
    if (fase !== "conversando") return;
    const relogio = window.setInterval(() => {
      if (prazoRef.current) setRestanteS(Math.max(0, Math.round((prazoRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(relogio);
  }, [fase]);

  /* Sem nenhum pedaço de resposta em 20 s, a tela avisa. */
  useEffect(() => {
    if (!conversa.aguardando) return;
    const espera = window.setTimeout(() => despachar({ tipo: "sem-resposta" }), ESPERA_DA_RESPOSTA_MS);
    return () => window.clearTimeout(espera);
  }, [conversa.aguardando, conversa.mensagens.length]);

  /* Fechar a aba no meio da conversa também encerra (o `keepalive` leva o aviso). */
  useEffect(() => {
    window.addEventListener("pagehide", fechar);
    return () => window.removeEventListener("pagehide", fechar);
  }, [fechar]);

  const enviar = useCallback((texto: string) => {
    const conexao = conexaoRef.current;
    const limpo = texto.trim();
    if (!conexao || !limpo) return;
    // Um gesto da pessoa: se o navegador segurou o áudio (autoplay), solta aqui.
    void audioRef.current?.iniciar().catch(() => undefined);
    // Pergunta nova corta a fala anterior: quem escreveu já não está ouvindo.
    if (audioRef.current?.falando) {
      audioRef.current.interromper();
      lipsyncRef.current.zerar();
      despachar({ tipo: "resposta-fim" });
    }
    despachar({ tipo: "pergunta-escrita", id: `escrita-${Date.now().toString(36)}`, texto: limpo });
    conexao.enviarTexto(limpo);
  }, []);

  const alternarMicrofone = useCallback(() => {
    const mic = microfoneRef.current;
    const conexao = conexaoRef.current;
    if (!mic || !conexao) return;
    void audioRef.current?.iniciar().catch(() => undefined);
    if (mic.ativo) {
      mic.desligar();
      conexao.fimDoAudio();
      setMicrofone("mudo");
      return;
    }
    setMicrofone("ligando");
    void mic
      .ligar((base64) => {
        // Sem fone, a voz do mascote voltaria pelo microfone e ele se interromperia.
        if (audioRef.current?.falando) return;
        conexaoRef.current?.enviarAudio(base64);
      })
      .then(() => setMicrofone("ligado"))
      // Permissão negada ou sem microfone: segue pelo chat.
      .catch(() => setMicrofone("bloqueado"));
  }, []);

  const encerrar = useCallback(() => {
    fechar();
    setFase("encerrada");
  }, [fechar]);

  const tentarDeNovo = useCallback(() => setTentativa((n) => n + 1), []);

  return {
    fase,
    erro,
    conversa,
    microfone,
    atendenteFalando,
    pessoaFalando,
    restanteS,
    carregandoModelo,
    semRosto,
    tentarDeNovo,
    enviar,
    alternarMicrofone,
    encerrar,
  };
}
