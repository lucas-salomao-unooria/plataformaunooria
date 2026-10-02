"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar } from "@edu/ui/ds";
import {
  caminhoDaTurma,
  continuarGerando,
  erroDaResposta,
  falhasAcumuladas,
  textoDoProgressoDaMidia,
  type ProgressoDaMidia,
  type ResumoDaMidia,
} from "@/lib/juri-estadual-tipos";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

/**
 * AS IMAGENS DOS ESTANDES de UMA atividade do Júri Estadual (ADR-130) — no
 * molde de `imagens-do-pacote.tsx` (Jornal): as imagens são do pacote GRAVADO,
 * e é na página da atividade, pronta ou em andamento, que o professor as gera
 * antes da aula.
 *
 * Um laço do cliente (`continuarGerando`): a api gera até duas por chamada, e
 * dezesseis não cabem numa. `?pacoteId=` diz qual atividade — a pronta também;
 * sem ele, a api ilustraria a em andamento, que pode ser outra.
 *
 * **A falha não bloqueia nada**: o estande sem imagem aparece com a arte
 * procedural da experiência, e a missão roda igual. Por isso o botão é
 * opcional e o aviso de falha é informativo.
 */
export function ImagensDoJuri({
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
  const rota = `/api/plataforma${caminhoDaTurma(turmaId)}/gerar-midia?pacoteId=${encodeURIComponent(pacoteId)}`;

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
          /* 429 `sem-saldo-de-ia` ou o provedor fora: a mensagem da api já está
             na voz certa, e a missão roda igual, com a arte desenhada. */
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
      // Os estandes da página mostram as imagens novas.
      if (vivo.current) transicionar(() => router.refresh());
    }
  }

  return (
    <Card variant="outlined" title="Imagens dos estandes">
      <div className="flex flex-col gap-2" data-imagens-do-juri>
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
          Opcional. As imagens saem duas por vez e podem levar alguns minutos: faça antes da aula. Estande sem imagem
          aparece com uma arte desenhada, e a missão roda igual.
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
              ? "1 estande não ganhou imagem e segue com a arte desenhada."
              : `${falhas.length} estandes não ganharam imagem e seguem com a arte desenhada.`}{" "}
            Tente de novo mais tarde.
          </p>
        ) : null}
        {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}
      </div>
    </Card>
  );
}
