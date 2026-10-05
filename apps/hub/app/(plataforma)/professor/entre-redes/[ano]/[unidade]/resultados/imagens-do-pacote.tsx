"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, NEWS_MEDIUM_LABELS, ProgressBar, Tag } from "@edu/ui/ds";
import {
  MEIO_NO_DS,
  continuarGerando,
  erroDaResposta,
  falhasAcumuladas,
  imagensProntasParaAula,
  textoDoProgressoDaMidia,
  type IdDeNoticia,
  type ImagemRegerada,
  type ImagensAprovadas,
  type NoticiaDoPacote,
  type ProgressoDaMidia,
} from "@/lib/jornal-escola-tipos";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

type EstadoDaImagem = "aprovada" | "aguardando" | "gerando" | "sem-imagem";

const ROTULO_DO_ESTADO: Record<EstadoDaImagem, { texto: string; variante: "success" | "warning" | "neutral" }> = {
  aprovada: { texto: "Aprovada", variante: "success" },
  aguardando: { texto: "Aguardando seu OK", variante: "warning" },
  gerando: { texto: "Gerando…", variante: "neutral" },
  "sem-imagem": { texto: "Sem imagem", variante: "neutral" },
};

/**
 * AS IMAGENS DAS NOTÍCIAS de UMA atividade do Jornal da Escola — geradas por
 * IA, VISTAS e APROVADAS pelo professor antes de chegarem à turma (ADR-147, o
 * pedido do PO). Antes havia só uma barra de progresso: as imagens iam para a
 * mesa das crianças sem que ninguém as tivesse visto.
 *
 * - "Gerar imagens" é o laço de antes (`continuarGerando`): a api gera até duas
 *   por chamada, porque o BFF corta em 30 s e oito não cabem. `?pacoteId=` diz
 *   qual atividade — a pronta também, que ainda não está no ar.
 * - Cada imagem aparece grande, com a manchete e o que ela deveria mostrar;
 *   "Gerar outra imagem" troca só aquela, e ela volta a esperar o OK.
 * - "Aprovar" manda as URLs QUE ESTÃO NA TELA: se outra aba gerou outra no
 *   meio, a api não aprova a que ninguém viu (`desatualizadas`) e a página relê.
 *
 * A aprovação é POR IMAGEM: com a atividade no ar, "Gerar outra" tira da turma
 * só aquela imagem até o novo OK — o cartão dela se desenha pelo meio. E a
 * atividade só vai ao ar com todas aprovadas (409 `imagens-nao-aprovadas`).
 *
 * Mora em DOIS lugares: a página da atividade e a fase 2 da CRIAÇÃO
 * (`atividades/nova/criar-jornal-escola.tsx`), onde gera sozinha ao abrir
 * (`gerarAoAbrir`), conta ao assistente quando tudo está aprovado
 * (`aoMudarAprovacao`) e não relê a página — não há página a reler ali.
 * Molde: `FaseDasImagens` da exp07ef1b (`grade-da-cobertura.tsx`).
 */
export function ImagensDoPacote({
  turmaId,
  pacoteId,
  noticias,
  imagensIniciais,
  aprovadasIniciais,
  podeEditar,
  gerarAoAbrir = false,
  aoMudarAprovacao,
  moldura = true,
}: {
  turmaId: string;
  pacoteId: string;
  noticias: readonly NoticiaDoPacote[];
  imagensIniciais: Readonly<Record<string, string>>;
  aprovadasIniciais: readonly IdDeNoticia[];
  /** Só o professor gera e aprova; a coordenação vê a grade. */
  podeEditar: boolean;
  /** Gera as que faltam assim que monta (a fase 2 da criação, logo depois de aprovar os textos). */
  gerarAoAbrir?: boolean;
  /** `true` quando todas estão aprovadas e nada está gerando. Com ela, a página não é relida. */
  aoMudarAprovacao?: (tudoAprovado: boolean) => void;
  /** Dentro do cartão da criação, sem o `Card` próprio. */
  moldura?: boolean;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const [imagens, setImagens] = useState<Record<string, string>>({ ...imagensIniciais });
  const [aprovadas, setAprovadas] = useState<ReadonlySet<IdDeNoticia>>(new Set(aprovadasIniciais));
  const [falhas, setFalhas] = useState<IdDeNoticia[]>([]);
  const [gerando, setGerando] = useState(false);
  const [regerando, setRegerando] = useState<ReadonlySet<IdDeNoticia>>(new Set());
  const [aprovando, setAprovando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /* A página relida (`router.refresh`) é a verdade: outra aba pode ter gerado
     ou aprovado no meio. Sem isto o `useState` ficaria com a primeira leitura. */
  useEffect(() => {
    setImagens({ ...imagensIniciais });
    setAprovadas(new Set(aprovadasIniciais));
  }, [imagensIniciais, aprovadasIniciais]);

  /* O laço pode estar no meio quando a página muda: sem isto ele seguiria
     gastando a quota. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const base = `/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}`;
  const pedem = noticias.filter((n) => n.descricaoImagem !== null);
  const total = pedem.length;
  const prontas = pedem.filter((n) => imagens[n.id]).length;
  const aguardando = pedem.filter((n) => imagens[n.id] && !aprovadas.has(n.id));
  const resumo = { total, prontas, aprovadas: prontas - aguardando.length };
  const ocupado = gerando || aprovando || regerando.size > 0;
  const completas = total > 0 && prontas >= total;
  const tudoAprovado = imagensProntasParaAula(resumo);

  function reler() {
    if (vivo.current && !aoMudarAprovacao) transicionar(() => router.refresh());
  }

  const liberado = tudoAprovado && !ocupado;
  useEffect(() => {
    aoMudarAprovacao?.(liberado);
  }, [liberado, aoMudarAprovacao]);

  async function gerar() {
    setGerando(true);
    setAviso(null);
    let acumuladas = falhas;
    /* Teto de voltas por precaução: `continuarGerando` já para quando uma
       chamada não anda, e cada volta faz até duas imagens. */
    const tetoDeVoltas = Math.max(total, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`${base}/gerar-midia?pacoteId=${encodeURIComponent(pacoteId)}`, { method: "POST" });
        if (!r.ok) {
          /* 429 `sem-saldo-de-ia` (a quota do professor) ou o provedor fora:
             a mensagem da api já está na voz certa. */
          setAviso(erroDaResposta(await r.json().catch(() => null), "As imagens não puderam ser geradas agora.").mensagem);
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        /* A api respondeu por outro pacote — não deveria, com o `?pacoteId=`;
           seguir seria gastar a quota ilustrando a atividade errada. */
        if (progresso.pacoteId !== pacoteId) break;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        if (!vivo.current) return;
        setImagens({ ...progresso.imagens });
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) setGerando(false);
      reler();
    }
  }

  async function regerar(noticiaId: IdDeNoticia) {
    setRegerando((atual) => new Set(atual).add(noticiaId));
    setAviso(null);
    try {
      const r = await fetch(
        `${base}/pacotes/${encodeURIComponent(pacoteId)}/imagens/${encodeURIComponent(noticiaId)}/regerar`,
        { method: "POST" },
      );
      if (!r.ok) {
        setAviso(
          erroDaResposta(await r.json().catch(() => null), "Não deu para gerar outra imagem agora. Tente de novo.").mensagem,
        );
        return;
      }
      const nova = (await r.json()) as ImagemRegerada;
      if (!vivo.current) return;
      setImagens((atual) => ({ ...atual, [nova.noticiaId]: nova.url }));
      setAprovadas((atual) => {
        const sem = new Set(atual);
        sem.delete(nova.noticiaId);
        return sem;
      });
      setFalhas((atual) => atual.filter((id) => id !== nova.noticiaId));
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) {
        setRegerando((atual) => {
          const sem = new Set(atual);
          sem.delete(noticiaId);
          return sem;
        });
      }
      reler();
    }
  }

  async function aprovar() {
    setAprovando(true);
    setAviso(null);
    try {
      const vistas: Record<string, string> = {};
      for (const n of aguardando) {
        const url = imagens[n.id];
        if (url) vistas[n.id] = url;
      }
      const r = await fetch(`${base}/pacotes/${encodeURIComponent(pacoteId)}/aprovar-imagens`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imagens: vistas }),
      });
      if (!r.ok) {
        setAviso(
          erroDaResposta(await r.json().catch(() => null), "Não deu para aprovar as imagens agora. Tente de novo.").mensagem,
        );
        return;
      }
      const resposta = (await r.json()) as ImagensAprovadas;
      if (!vivo.current) return;
      setAprovadas(new Set(resposta.aprovadas));
      if (resposta.desatualizadas.length > 0) {
        setAviso(
          resposta.desatualizadas.length === 1
            ? "Uma imagem mudou enquanto você conferia (outra aba gerou outra). Ela foi recarregada: confira e aprove de novo."
            : `${resposta.desatualizadas.length} imagens mudaram enquanto você conferia (outra aba gerou outras). Elas foram recarregadas: confira e aprove de novo.`,
        );
      }
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) setAprovando(false);
      reler();
    }
  }

  /* A fase 2 da criação começa gerando: os textos acabaram de ser aprovados, e
     esperar outro clique seria o professor procurar o que fazer. As herdadas
     (mesma descrição de um pacote anterior da turma) já vêm prontas. */
  const comecou = useRef(false);
  useEffect(() => {
    if (comecou.current || !gerarAoAbrir || !podeEditar) return;
    comecou.current = true;
    if (pedem.some((n) => !imagensIniciais[n.id])) void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez, ao montar
  }, []);

  function estadoDe(n: NoticiaDoPacote): EstadoDaImagem {
    if (regerando.has(n.id)) return "gerando";
    if (!imagens[n.id]) return gerando ? "gerando" : "sem-imagem";
    return aprovadas.has(n.id) ? "aprovada" : "aguardando";
  }

  const grade = (
    <div
      className="flex flex-col gap-4"
      data-imagens-do-pacote
      data-pacote-das-imagens={pacoteId}
      data-imagens-aprovadas={tudoAprovado ? "sim" : "nao"}
    >
      <div className="flex flex-col gap-2">
        {total > 0 ? (
          <ProgressBar
            label={textoDoProgressoDaMidia(resumo)}
            value={resumo.aprovadas}
            max={total}
            valueFormatter={(v, m) => `${v} de ${m} aprovadas`}
            variant={tudoAprovado ? "success" : "brand"}
            data-progresso-midia
          />
        ) : (
          <p className="text-[12px] text-unooria-neutral-600">{textoDoProgressoDaMidia(resumo)}</p>
        )}
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          As imagens são geradas por IA e só aparecem para a turma depois do seu OK. Confira cada uma junto da
          manchete; se uma não combinar com a notícia, use “Gerar outra imagem”. A atividade só vai ao ar com todas
          as imagens aprovadas. Elas saem duas por vez e podem levar alguns minutos: faça antes da aula.
        </p>
      </div>

      {podeEditar && (!completas || aguardando.length > 0) ? (
        <div className="flex flex-wrap items-center gap-3">
          {!completas ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="image" size={18} />}
              onClick={() => void gerar()}
              isDisabled={ocupado || total === 0}
              data-acao="gerar-imagens"
            >
              {gerando ? "Gerando imagens…" : prontas > 0 ? "Gerar as que faltam" : "Gerar imagens"}
            </Button>
          ) : null}
          {aguardando.length > 0 ? (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="check" size={18} />}
              onClick={() => void aprovar()}
              isDisabled={ocupado}
              isLoading={aprovando}
              data-acao="aprovar-imagens"
            >
              {aguardando.length === 1 ? "Aprovar a imagem" : `Aprovar as ${aguardando.length} imagens`}
            </Button>
          ) : null}
        </div>
      ) : null}

      {falhas.length > 0 && !gerando ? (
        <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
          {falhas.length === 1 ? "1 notícia ficou sem imagem." : `${falhas.length} notícias ficaram sem imagem.`} Tente de
          novo: sem todas as imagens aprovadas, a atividade não vai ao ar.
        </p>
      ) : null}
      {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}

      {total > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="As imagens, notícia por notícia">
          {pedem.map((n) => {
            const estado = estadoDe(n);
            const url = imagens[n.id];
            const rotulo = ROTULO_DO_ESTADO[estado];
            return (
              <li
                key={n.id}
                className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3"
                data-imagem-da-noticia={n.id}
                data-estado-da-imagem={estado}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-unooria-neutral-600">
                    {NEWS_MEDIUM_LABELS[MEIO_NO_DS[n.meio]]} · {n.veiculo}
                  </span>
                  <Tag variant={rotulo.variante} size="sm">
                    {rotulo.texto}
                  </Tag>
                </div>

                {/* O quadro tem a proporção da imagem da criança (16:9). É MEDIDA, não componente. */}
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-unooria-neutral-100">
                  {estado === "gerando" ? (
                    <span className="flex items-center gap-2 text-[12px] text-unooria-neutral-600" role="status">
                      <Icon name="hourglass_top" size={18} /> Gerando a imagem…
                    </span>
                  ) : url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={n.descricaoImagem ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <span className="px-3 text-center text-[12px] text-unooria-neutral-600">Ainda sem imagem</span>
                  )}
                </div>

                <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">{n.manchete}</p>
                <p className="text-[12px] leading-snug text-unooria-neutral-600">
                  <span className="font-semibold">O que a imagem deve mostrar:</span> {n.descricaoImagem}
                </p>

                {podeEditar && estado !== "gerando" && (url || !gerando) ? (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      leftIcon={<Icon name="refresh" size={16} />}
                      onClick={() => void regerar(n.id)}
                      isDisabled={ocupado}
                      data-acao="gerar-outra-imagem"
                    >
                      {url ? "Gerar outra imagem" : "Tentar gerar a imagem"}
                    </Button>
                  </div>
                ) : null}
              </li>
              );
            })}
          </ul>
        ) : null}
      </div>
  );

  return moldura ? (
    <Card variant="outlined" title="Imagens das notícias">
      {grade}
    </Card>
  ) : (
    grade
  );
}
