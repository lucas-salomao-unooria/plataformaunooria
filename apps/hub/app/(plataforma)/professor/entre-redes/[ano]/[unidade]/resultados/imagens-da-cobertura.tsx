"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar } from "@edu/ui/ds";
import {
  continuarGerando,
  falhasAcumuladas,
  textoDoProgressoDaMidia,
  type ErroDaSelecao,
  type ProgressoDaMidia,
  type ResumoDaMidia,
} from "@/lib/a-selecao-tipos";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

/**
 * AS IMAGENS DOS POSTS de UMA atividade (ADR-130) — saiu do preparo, que virou
 * a criação: as imagens são da cobertura GRAVADA, e é na página da atividade,
 * pronta ou em andamento, que a professora as gera antes da aula.
 *
 * Um laço do cliente (`continuarGerando`): a api gera até duas por chamada,
 * porque o BFF corta em 30 s e doze não cabem. `?coberturaId=` diz qual
 * atividade — a pronta também, que ainda não está no ar.
 */
export function ImagensDaCobertura({
  turmaId,
  coberturaId,
  inicial,
}: {
  turmaId: string;
  coberturaId: string;
  inicial: ResumoDaMidia;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const [midia, setMidia] = useState<ResumoDaMidia>(inicial);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /* O laço pode estar no meio quando a página muda: sem isto ele seguiria
     gastando a quota. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const completas = midia.total > 0 && midia.prontas >= midia.total;
  const rota = `/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/gerar-midia?coberturaId=${encodeURIComponent(coberturaId)}`;

  async function gerar() {
    setGerando(true);
    setAviso(null);
    let acumuladas = falhas;
    /* Teto de voltas por precaução: `continuarGerando` já para quando uma
       chamada não anda, e cada volta faz até duas imagens. */
    const tetoDeVoltas = Math.max(midia.total, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(rota, { method: "POST" });
        if (!r.ok) {
          /* 429 `sem-saldo-de-ia` (a quota do professor) ou o limite por
             minuto: a mensagem da api já está na voz certa, e a missão roda
             igual com a descrição da cena. */
          const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
          setAviso(corpo.mensagem ?? "As imagens não puderam ser geradas agora.");
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        setMidia({ total: progresso.total, prontas: progresso.prontas });
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      setGerando(false);
      if (vivo.current) transicionar(() => router.refresh());
    }
  }

  return (
    <Card variant="outlined" title="Imagens dos posts">
      <div className="flex flex-col gap-2" data-imagens-da-cobertura>
        {midia.total > 0 ? (
          <ProgressBar
            label={textoDoProgressoDaMidia(midia)}
            value={midia.prontas}
            max={midia.total}
            valueFormatter={(v, m) => `${v} de ${m}`}
            variant={completas ? "success" : "brand"}
            data-progresso-midia
          />
        ) : (
          <p className="text-[12px] text-unooria-neutral-600">{textoDoProgressoDaMidia(midia)}</p>
        )}
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          Opcional. As imagens saem duas por vez e podem levar alguns minutos: faça antes da aula. Post sem imagem
          aparece com a descrição da cena, e a missão roda igual. Os posts de números da cobertura curada já têm
          gráfico e não pedem imagem.
        </p>
        <div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icon name="image" size={18} />}
            onClick={() => void gerar()}
            isDisabled={gerando || completas || midia.total === 0}
            data-acao="gerar-imagens"
          >
            {gerando ? "Gerando imagens…" : "Gerar imagens"}
          </Button>
        </div>
        {falhas.length > 0 ? (
          <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
            {falhas.length === 1
              ? "1 post não ganhou imagem e segue com a descrição da cena."
              : `${falhas.length} posts não ganharam imagem e seguem com a descrição da cena.`}{" "}
            Tente de novo mais tarde.
          </p>
        ) : null}
        {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}
      </div>
    </Card>
  );
}
