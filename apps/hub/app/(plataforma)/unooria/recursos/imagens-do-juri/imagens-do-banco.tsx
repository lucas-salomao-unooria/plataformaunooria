"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, SectionHeader, Tabs, Tag } from "@edu/ui/ds";
import {
  CAMINHO_DAS_IMAGENS_DO_BANCO,
  areaDoProjeto,
  continuarGerando,
  erroDaResposta,
  falhasAcumuladas,
  idsDoBancoPorArea,
  numeroDoProjeto,
  rotuloCurtoDaArea,
  rotuloDaAbaDaArea,
  textoDoProgressoDoBanco,
  type Area,
  type GeracaoDoBancoPadrao,
  type ImagensDoBancoPadrao,
} from "@/lib/juri-estadual-tipos";

const SEM_CONEXAO = "A conexão falhou. As imagens que já saíram ficaram guardadas; tente de novo.";

type Aviso = { tipo: "success" | "warning" | "error"; texto: string };

/**
 * A grade e o laço das imagens do banco padrão do Júri. O laço é o mesmo da
 * customização do professor (`continuarGerando`): a api gera ATÉ QUATRO por
 * chamada (o BFF corta a espera em 3 min), e a tela repete enquanto falta
 * alguma e a chamada anterior gerou pelo menos uma — repetir depois de uma
 * volta sem nada seria pedir de novo as mesmas que o provedor acabou de recusar.
 *
 * A grade é agrupada por área com o `Tabs` do DS (controlado, só a aba aberta
 * renderizada). A api devolve só os ids e as URLs — o conteúdo do banco mora
 * nela —, por isso cada imagem é nomeada pelo número do projeto na área.
 */
export function ImagensDoBancoDoJuri({ inicial }: { inicial: ImagensDoBancoPadrao }) {
  const [banco, setBanco] = useState<ImagensDoBancoPadrao>(inicial);
  const [gerando, setGerando] = useState(false);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [area, setArea] = useState<Area>("area_a");

  /* O laço não pode seguir pagando imagem depois que a pessoa saiu da tela. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const porArea = idsDoBancoPorArea(banco);
  const aberta = porArea.find((a) => a.area === area) ?? porArea[0];

  async function gerar() {
    setGerando(true);
    setAviso(null);
    let acumuladas = falhas;
    let geradas = 0;
    let ultimo: GeracaoDoBancoPadrao | null = null;
    /* Teto de voltas por precaução: `continuarGerando` já para quando uma
       chamada não anda, e cada volta faz até quatro imagens. */
    const tetoDeVoltas = Math.max(banco.faltam.length, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`/api/plataforma${CAMINHO_DAS_IMAGENS_DO_BANCO}`, { method: "POST" });
        if (!r.ok) {
          /* 429 `muitas-requisicoes` (o rate limit da rota) ou o provedor fora:
             a frase da api já está na voz certa. */
          const { mensagem } = erroDaResposta(await r.json().catch(() => null), "As imagens não puderam ser geradas agora.");
          if (vivo.current) setAviso({ tipo: "error", texto: mensagem });
          return;
        }
        const progresso = (await r.json()) as GeracaoDoBancoPadrao;
        if (!vivo.current) return;
        ultimo = progresso;
        geradas += progresso.geradas.length;
        acumuladas = falhasAcumuladas(acumuladas, progresso);
        setBanco({
          total: progresso.total,
          prontas: progresso.prontas,
          faltam: progresso.faltam,
          completo: progresso.completo,
          imagens: progresso.imagens,
        });
        setFalhas(acumuladas);
        if (!continuarGerando(progresso)) break;
      }
      if (!vivo.current || !ultimo) return;
      if (ultimo.completo) {
        setAviso({ tipo: "success", texto: `Concluído: as ${ultimo.total} imagens do banco estão prontas.` });
      } else {
        const faltam = ultimo.faltam.length;
        setAviso({
          tipo: "warning",
          texto:
            `${geradas === 1 ? "1 imagem saiu" : `${geradas} imagens saíram`} nesta rodada, e ` +
            `${faltam === 1 ? "1 ainda falta" : `${faltam} ainda faltam`}: o gerador recusou ou não respondeu. ` +
            "Tente de novo daqui a pouco — as que já saíram não são geradas outra vez.",
        });
      }
    } catch {
      if (vivo.current) setAviso({ tipo: "error", texto: SEM_CONEXAO });
    } finally {
      if (vivo.current) setGerando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4" data-imagens-do-banco-do-juri>
      <SectionHeader
        title="Imagens do banco padrão do Júri Estadual"
        description={`Uma imagem para cada um dos ${banco.total} projetos do banco padrão da missão do 6º ano. Toda atividade criada com o banco padrão usa as que já existem; o projeto sem imagem aparece com a arte desenhada da missão.`}
      />

      <Card variant="outlined">
        <div className="flex flex-col gap-3">
          <ProgressBar
            label={textoDoProgressoDoBanco(banco)}
            value={banco.prontas}
            max={Math.max(banco.total, 1)}
            valueFormatter={(v, m) => `${v} de ${m}`}
            variant={banco.completo ? "success" : "brand"}
            data-progresso-do-banco
          />
          <p className="max-w-3xl text-[13px] leading-snug text-unooria-neutral-700">
            Cada rodada gera até quatro imagens, e a tela repete sozinha até não faltar nenhuma. As que faltam levam
            vários minutos: deixe esta página aberta enquanto saem. O custo aparece em Custos de IA.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icon name="image" size={18} />}
              onClick={() => void gerar()}
              isDisabled={gerando || banco.completo}
              isLoading={gerando}
              data-acao="gerar-imagens-do-banco"
            >
              {gerando ? "Gerando…" : "Gerar as imagens que faltam"}
            </Button>
            <span className="text-[12px] leading-snug text-unooria-neutral-600" role="status" aria-live="polite">
              {gerando
                ? `Gerando as que faltam: ${banco.prontas} de ${banco.total} prontas.`
                : banco.completo
                  ? "Não falta nenhuma imagem."
                  : `${banco.faltam.length === 1 ? "Falta 1 imagem" : `Faltam ${banco.faltam.length} imagens`}.`}
            </span>
          </div>
          {falhas.length > 0 && !gerando ? (
            <p className="text-[12px] leading-snug text-unooria-neutral-700" data-falharam={falhas.length}>
              {falhas.length === 1 ? "1 imagem falhou" : `${falhas.length} imagens falharam`} nesta sessão (
              {falhas.map((id) => `${rotuloCurtoDaArea(areaDoProjeto(id))}, projeto ${numeroDoProjeto(id)}`).join("; ")}).
              Gerar de novo tenta só as que faltam.
            </p>
          ) : null}
          {aviso ? <FeedbackAlert type={aviso.tipo} description={aviso.texto} /> : null}
        </div>
      </Card>

      <Card variant="outlined" title="As imagens, por área">
        <div className="flex flex-col gap-4">
          <Tabs
            value={aberta?.area}
            onChange={(valor) => setArea(String(valor) as Area)}
            items={porArea.map((a) => ({
              value: a.area,
              label: rotuloDaAbaDaArea(rotuloCurtoDaArea(a.area), a.ids.length, {
                quantos: a.ids.filter((id) => !banco.imagens[id]).length,
                texto: "sem imagem",
              }),
            }))}
          />
          {aberta ? (
            <ul
              key={aberta.area}
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
              aria-label={`As imagens da ${rotuloCurtoDaArea(aberta.area)}`}
              data-area={aberta.area}
            >
              {aberta.ids.map((id) => {
                const url = banco.imagens[id];
                const falhou = falhas.includes(id);
                const nome = `Projeto ${numeroDoProjeto(id)}`;
                return (
                  <li
                    key={id}
                    className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3"
                    data-imagem-do-banco={id}
                    data-tem-imagem={url ? "sim" : "nao"}
                  >
                    {/* O quadro tem a proporção da foto do estande no post (4:3). É MEDIDA, não componente. */}
                    <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-unooria-neutral-100">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={`Imagem do projeto ${numeroDoProjeto(id)} da ${rotuloCurtoDaArea(aberta.area)} do banco padrão`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="px-3 text-center text-[12px] text-unooria-neutral-600">
                          {gerando ? "Na fila para gerar" : "Ainda sem imagem"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-unooria-neutral-950">{nome}</span>
                      <Tag variant={url ? "success" : falhou ? "warning" : "neutral"} size="sm">
                        {url ? "Pronta" : falhou ? "Falhou" : "Falta"}
                      </Tag>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

