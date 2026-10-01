"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar } from "@edu/ui/ds";
import {
  continuarGerando,
  erroDaResposta,
  falhasAcumuladas,
  textoDoProgressoDaMidia,
  type IdDeNoticia,
  type ProgressoDaMidia,
  type ResumoDaMidia,
} from "@/lib/jornal-escola-tipos";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

/**
 * AS IMAGENS DAS NOTÍCIAS de UMA atividade do Jornal da Escola (ADR-130) —
 * saiu do preparo, que virou a criação: as imagens são do pacote GRAVADO, e é
 * na página da atividade, pronta ou em andamento, que o professor as gera antes
 * da aula. Molde: `imagens-da-cobertura.tsx` (exp07ef1b).
 *
 * Um laço do cliente (`continuarGerando`): a api gera até duas por chamada,
 * porque o BFF corta em 30 s e oito não cabem. `?pacoteId=` diz qual atividade
 * — a pronta também, que ainda não está no ar; sem ele, a api ilustraria a em
 * andamento, que pode ser outra.
 */
export function ImagensDoPacote({
  turmaId,
  pacoteId,
  inicial,
}: {
  turmaId: string;
  pacoteId: string;
  inicial: ResumoDaMidia;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const [midia, setMidia] = useState<ResumoDaMidia>(inicial);
  const [falhas, setFalhas] = useState<IdDeNoticia[]>([]);
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
  const rota = `/api/plataforma/jornal-escola/turmas/${encodeURIComponent(turmaId)}/gerar-midia?pacoteId=${encodeURIComponent(pacoteId)}`;

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
          /* 429 `sem-saldo-de-ia` (a quota do professor) ou o provedor fora:
             a mensagem da api já está na voz certa, e a missão roda igual,
             com o cartão desenhado pelo meio. */
          setAviso(erroDaResposta(await r.json().catch(() => null), "As imagens não puderam ser geradas agora.").mensagem);
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        /* A api respondeu por outro pacote — não deveria, com o `?pacoteId=`;
           seguir seria gastar a quota ilustrando a atividade errada. */
        if (progresso.pacoteId !== pacoteId) break;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        setMidia({ total: progresso.total, prontas: progresso.prontas });
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      setGerando(false);
      // O painel da aula lê o resumo da mídia do pacote: ele anda junto.
      if (vivo.current) transicionar(() => router.refresh());
    }
  }

  return (
    <Card variant="outlined" title="Imagens das notícias">
      <div className="flex flex-col gap-2" data-imagens-do-pacote>
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
          Opcional. As imagens saem duas por vez e podem levar alguns minutos: faça antes da aula. Notícia sem
          imagem aparece com o desenho do meio, e a missão roda igual.
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
              ? "1 notícia não ganhou imagem e segue com o desenho do meio."
              : `${falhas.length} notícias não ganharam imagem e seguem com o desenho do meio.`}{" "}
            Tente de novo mais tarde.
          </p>
        ) : null}
        {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}
      </div>
    </Card>
  );
}
