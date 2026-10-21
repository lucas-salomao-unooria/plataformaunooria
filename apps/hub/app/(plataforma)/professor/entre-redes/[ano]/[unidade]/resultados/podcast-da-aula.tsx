"use client";

import { useEffect, useRef, useState } from "react";
import { AudioPlayer, Button, Card, FeedbackAlert, Icon } from "@edu/ui/ds";
import {
  continuarGerandoPodcast,
  textoDoProgressoDoPodcast,
  type PodcastDaAtividade,
  type ProgressoDoPodcast,
} from "@/lib/podcast-tipos";
import type { PodcastNaAula } from "@/lib/podcast-servidor";

/**
 * O PODCAST DE RECAPITULAÇÃO de qualquer missão (ADR-150) — do professor, para
 * tocar à turma depois da aula se quiser (decisão do dono do produto,
 * 2026-09-26). O texto fala com o estudante; quem decide quando ele toca é quem
 * conduz. As rotas são as da plataforma (`/podcast/:expId/…`), e a missão
 * entra pelo `expId`.
 *
 * Mora AQUI, na aula da turma, e não no guia: as falas do tema contam o que a
 * turma viu NESTA atividade (o professor as revisou na criação), e o guia é o
 * mesmo para todas.
 *
 * O áudio é um laço do cliente, como as imagens: a api sintetiza UM trecho por
 * chamada — a voz é o TTS do Gemini, pelo provider da api — e, com todos,
 * emenda o episódio. Os blocos fixos saem uma vez por contrato; o que custa é o
 * bloco com as falas de um tema novo.
 *
 * **A transcrição fica sempre na tela** (é o roteiro inteiro): sem áudio — o
 * mock falha fechado em dev, e o provedor pode estar fora — o podcast não
 * some, só não toca. O `AudioPlayer` do DS diz o porquê no lugar da barra.
 */
export function PodcastDaAula({
  expId,
  turmaId,
  atividadeId,
  inicial,
  aviso: avisoDaMissao,
}: {
  /** O código da missão (ADR-110): `exp04ef1b`, `exp07ef1b`. */
  expId: string;
  turmaId: string;
  /** A atividade do podcast (ADR-130): a da página, em andamento ou pronta. */
  atividadeId: string;
  inicial: PodcastDaAtividade;
  /**
   * Um recado da MISSÃO no topo do cartão — quando tocar o episódio, se ela tem
   * hora certa (o Júri: só depois da Galeria Oculta). O módulo de podcast não
   * trava por etapa; quem sabe a hora é a página da missão. Sem ele, nada.
   */
  aviso?: string;
}) {
  const [estado, setEstado] = useState<PodcastDaAtividade>(inicial);
  const [gerando, setGerando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);

  /* A atividade mudou (uma aprovação nova): o roteiro é outro. Ajuste de
     estado durante o render, pelo id — o `router.refresh()` das imagens entrega
     um objeto novo com a MESMA atividade, e isso não pode apagar o progresso. */
  const [atividadeVista, setAtividadeVista] = useState(inicial.atividadeId);
  if (inicial.atividadeId !== atividadeVista) {
    setAtividadeVista(inicial.atividadeId);
    setEstado(inicial);
    setFalhou(false);
    setAviso(null);
  }

  /* Trocar de turma desmonta este cartão no meio do laço: sem isto ele seguiria gastando a quota. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const base = `/api/plataforma/podcast/${encodeURIComponent(expId)}/turmas/${encodeURIComponent(turmaId)}`;

  async function gerarAudio() {
    setGerando(true);
    setFalhou(false);
    setAviso(null);
    /* Teto de voltas por precaução: `continuarGerandoPodcast` já para quando uma
       chamada não anda, e cada volta faz um trecho. */
    const tetoDeVoltas = Math.max(estado.trechos.total, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`${base}/gerar?atividadeId=${encodeURIComponent(atividadeId)}`, {
          method: "POST",
        });
        if (!r.ok) {
          /* 429 `sem-saldo-de-ia` (a quota do professor) ou o limite por
             minuto: a mensagem da api já está na voz certa. */
          const corpo = (await r.json().catch(() => ({}))) as { mensagem?: string };
          setAviso(corpo.mensagem ?? "O áudio não pôde ser gerado agora. A transcrição continua abaixo.");
          break;
        }
        const progresso = (await r.json()) as ProgressoDoPodcast;
        if (progresso.atividadeId !== estado.atividadeId) break; // outra aprovação trocou a atividade
        setEstado(progresso);
        if (progresso.falhou) setFalhou(true);
        if (!continuarGerandoPodcast(progresso)) break;
      }
    } catch {
      setAviso("A conexão falhou. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  const pronto = estado.url !== null;
  const motivo = pronto
    ? undefined
    : estado.trechos.prontos === 0
      ? "O áudio ainda não foi gerado. Gere abaixo: sai um trecho por vez e leva alguns minutos. A transcrição completa está logo abaixo."
      : `O áudio está sendo preparado: ${estado.trechos.prontos} de ${estado.trechos.total} trechos prontos.`;

  return (
    <Card variant="elevated" title="Podcast de recapitulação">
      <div className="flex flex-col gap-4" data-podcast-da-aula data-podcast-pronto={pronto ? "sim" : "nao"}>
        {avisoDaMissao ? (
          <div data-aviso-do-podcast>
            <FeedbackAlert type="info" description={avisoDaMissao} />
          </div>
        ) : null}
        <p className="max-w-3xl text-[13px] leading-relaxed text-unooria-neutral-700">
          Um episódio curto que recapitula a missão com a turma. <strong>É seu:</strong> toque depois
          da aula, no projetor ou na caixa de som, se achar que ajuda a fechar a conversa. As falas
          que contam o que a turma viu são as desta atividade, “{estado.tema}”.
        </p>

        <AudioPlayer
          src={estado.url ?? undefined}
          title={estado.titulo}
          description={estado.descricao}
          unavailableReason={motivo}
        />

        <div className="flex flex-wrap items-center gap-3">
          {!pronto ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="record_voice_over" size={18} />}
              onClick={() => void gerarAudio()}
              isDisabled={gerando}
              data-acao="gerar-podcast"
            >
              {gerando ? "Gerando o áudio…" : "Gerar o áudio do podcast"}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Icon name="open_in_new" size={18} />}
              href={estado.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir o áudio em outra aba (para baixar)
            </Button>
          )}
          <span className="text-[12px] text-unooria-neutral-600" data-progresso-podcast>
            {textoDoProgressoDoPodcast(estado)}
          </span>
        </div>

        {falhou ? (
          <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
            Um trecho do áudio não saiu agora. A transcrição abaixo está completa; tente gerar de novo
            mais tarde.
          </p>
        ) : null}
        {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}

        {/* Renderização CONDICIONAL, e não `Collapse`, pela mesma razão da grade
            de posts: fechado, o `Collapse` do DS mantém o conteúdo no DOM sob
            `aria-hidden`. Aberta, a transcrição é o roteiro inteiro. */}
        <div>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icon name={lendo ? "expand_less" : "expand_more"} size={18} />}
            onClick={() => setLendo((v) => !v)}
            aria-expanded={lendo}
            data-acao="ler-transcricao"
          >
            {lendo ? "Esconder a transcrição" : "Ler a transcrição"}
          </Button>
        </div>
        {lendo ? (
          <div className="flex max-w-3xl flex-col gap-4" data-transcricao-podcast>
            {estado.roteiro.map((trecho) => (
              <section key={trecho.bloco} className="flex flex-col gap-2">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-unooria-neutral-500">
                  {trecho.titulo}
                </h3>
                {trecho.falas.map((fala, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-unooria-neutral-800">
                    <strong className="text-unooria-neutral-950">{fala.falante}:</strong> {fala.texto}
                  </p>
                ))}
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * O cartão da aula: o podcast, ou o aviso de que a atividade com tema próprio
 * foi criada antes do podcast (409 da api) — sem o aviso o cartão sumiria, e o
 * professor procuraria pelo que o guia promete. `null` (api fora, missão sem
 * podcast) não mostra nada. A `key` é a atividade: o laço do áudio vive em
 * `useState`.
 */
export function CartaoDoPodcast({
  expId,
  turmaId,
  atividadeId,
  podcast,
  aviso,
}: {
  expId: string;
  turmaId: string;
  atividadeId: string;
  podcast: PodcastNaAula;
  /** O recado da missão sobre a hora de tocar (ver `PodcastDaAula`). Só vai com o episódio. */
  aviso?: string;
}) {
  if (!podcast) return null;
  if ("indisponivel" in podcast) {
    return (
      <Card variant="elevated" title="Podcast de recapitulação">
        <div data-podcast-indisponivel>
          <FeedbackAlert type="info" description={podcast.indisponivel} />
        </div>
      </Card>
    );
  }
  return (
    <PodcastDaAula
      key={`podcast-${atividadeId}`}
      expId={expId}
      turmaId={turmaId}
      atividadeId={atividadeId}
      inicial={podcast.podcast}
      aviso={aviso}
    />
  );
}
