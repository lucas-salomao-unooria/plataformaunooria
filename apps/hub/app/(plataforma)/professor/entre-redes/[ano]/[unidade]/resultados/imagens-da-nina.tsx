"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, Tag } from "@edu/ui/ds";
import {
  CHAVES_DAS_IMAGENS,
  COPY_DO_PREPARO,
  ROTULO_DA_IMAGEM,
  ROTULO_DO_SUPORTE,
  SUPORTE_OMITIDO,
  caminhoDoPacote,
  continuarGerando,
  erroDaResposta,
  type ChaveDaImagem,
  type ConteudoDoPacote,
  type ImagemRefeita,
  type ImagensAprovadas,
  type ProgressoDaMidia,
} from "@/lib/nina-noticia-tipos";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

/**
 * AS IMAGENS de UMA atividade da exp03ef1b — a SEGUNDA fase da aprovação
 * (ADR-146): geradas por IA, VISTAS e APROVADAS pela professora antes de a turma
 * as ver. Molde: `imagens-do-juri.tsx`, com quatro imagens só (as três fotos da
 * feira e o cartaz comum), sem abas.
 *
 * - **A foto do TELÃO vem em DESTAQUE** (spec §0.5): é ela que a busca deixa de
 *   fora, e o carimbo K1 ("A foto mostra o pátio?") é ✔ — se o pátio não
 *   aparecer sem ambiguidade, a missão ensina errado. A tela pede para conferir
 *   isso, e "Refazer imagem" troca só aquela.
 * - **O laço é do cliente** (`continuarGerando`): cada `gerar-midia` faz
 *   algumas imagens, dentro do teto do BFF; para quando completa ou quando uma
 *   volta não gera nada.
 * - **Aprovadas, congelam** (a api responde 409 a gerar e a refazer), e só
 *   então a atividade vai ao ar (sem isto, 409 `imagens-nao-aprovadas`). A que
 *   faltar segue com a ilustração local da experiência.
 *
 * Mora em DOIS lugares: a página da atividade e a fase 2 da CRIAÇÃO, onde gera
 * sozinha ao abrir (`gerarAoAbrir`), avisa o assistente (`aoMudarAprovacao`) e
 * não relê a página.
 */
export function ImagensDaNina({
  turmaId,
  pacoteId,
  conteudo,
  imagensIniciais,
  aprovadasEmInicial,
  podeEditar,
  gerarAoAbrir = false,
  aoMudarAprovacao,
  moldura = true,
}: {
  turmaId: string;
  pacoteId: string;
  conteudo: ConteudoDoPacote;
  imagensIniciais: Readonly<Partial<Record<ChaveDaImagem, string>>>;
  aprovadasEmInicial: string | null;
  podeEditar: boolean;
  gerarAoAbrir?: boolean;
  aoMudarAprovacao?: (aprovadas: boolean) => void;
  moldura?: boolean;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const [imagens, setImagens] = useState<Partial<Record<ChaveDaImagem, string>>>({ ...imagensIniciais });
  const [aprovadasEm, setAprovadasEm] = useState<string | null>(aprovadasEmInicial);
  const [gerando, setGerando] = useState(false);
  const [refazendo, setRefazendo] = useState<ChaveDaImagem | null>(null);
  const [aprovando, setAprovando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    setImagens({ ...imagensIniciais });
    setAprovadasEm(aprovadasEmInicial);
  }, [imagensIniciais, aprovadasEmInicial]);

  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const base = `/api/plataforma${caminhoDoPacote(turmaId, pacoteId)}`;
  const total = CHAVES_DAS_IMAGENS.length;
  const prontas = CHAVES_DAS_IMAGENS.filter((c) => imagens[c]).length;
  const aprovadas = aprovadasEm !== null;
  const ocupado = gerando || aprovando || refazendo !== null;

  function reler() {
    if (vivo.current && !aoMudarAprovacao) transicionar(() => router.refresh());
  }

  const liberado = aprovadas && !ocupado;
  useEffect(() => {
    aoMudarAprovacao?.(liberado);
  }, [liberado, aoMudarAprovacao]);

  async function gerar() {
    setGerando(true);
    setAviso(null);
    try {
      for (let volta = 0; volta < total + 2 && vivo.current; volta += 1) {
        const r = await fetch(`${base}/gerar-midia`, { method: "POST" });
        if (!r.ok) {
          setAviso(erroDaResposta(await r.json().catch(() => null), "As imagens não puderam ser geradas agora.").mensagem);
          break;
        }
        const progresso = (await r.json()) as ProgressoDaMidia;
        if (progresso.pacoteId !== pacoteId || !vivo.current) break;
        setImagens({ ...progresso.imagens });
        if (!continuarGerando(progresso)) break;
      }
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) setGerando(false);
      reler();
    }
  }

  async function refazer(chave: ChaveDaImagem) {
    setRefazendo(chave);
    setAviso(null);
    try {
      const r = await fetch(`${base}/imagens/${encodeURIComponent(chave)}/refazer`, { method: "POST" });
      if (!r.ok) {
        setAviso(erroDaResposta(await r.json().catch(() => null), "Não deu para refazer a imagem agora. Tente de novo.").mensagem);
        return;
      }
      const nova = (await r.json()) as ImagemRefeita;
      if (!vivo.current) return;
      setImagens((atual) => ({ ...atual, [nova.chave]: nova.url }));
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) setRefazendo(null);
      reler();
    }
  }

  async function aprovar() {
    setAprovando(true);
    setAviso(null);
    try {
      const r = await fetch(`${base}/aprovar-imagens`, { method: "POST" });
      if (!r.ok) {
        setAviso(erroDaResposta(await r.json().catch(() => null), "Não deu para aprovar as imagens agora. Tente de novo.").mensagem);
        return;
      }
      const resposta = (await r.json()) as ImagensAprovadas;
      if (vivo.current) setAprovadasEm(resposta.imagensAprovadasEm);
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) setAprovando(false);
      reler();
    }
  }

  const comecou = useRef(false);
  useEffect(() => {
    if (comecou.current || !gerarAoAbrir || !podeEditar || aprovadasEmInicial) return;
    comecou.current = true;
    if (CHAVES_DAS_IMAGENS.some((c) => !imagensIniciais[c])) void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez, ao montar
  }, []);

  /** O que a cena de cada imagem deveria mostrar (a descrição que virou o pedido da imagem). */
  function descricaoDe(chave: ChaveDaImagem): { descricao: string; alt: string; manchete: string | null } {
    if (chave === "cartaz") return { ...conteudo.cartaz.imagem, manchete: conteudo.cartaz.texto };
    const r = conteudo.reportagens.find((x) => x.suporte === chave);
    return { descricao: r?.imagem.descricao ?? "", alt: r?.imagem.alt ?? ROTULO_DA_IMAGEM[chave], manchete: r?.manchete ?? null };
  }

  const resumo = aprovadas
    ? prontas === total
      ? `As ${total} imagens estão aprovadas.`
      : `Imagens aprovadas. ${total - prontas === 1 ? "1 segue" : `${total - prontas} seguem`} com a ilustração da missão.`
    : `${prontas} de ${total} imagens prontas`;

  const grade = (
    <div className="flex flex-col gap-4" data-imagens-da-nina data-imagens-aprovadas={aprovadas ? "sim" : "nao"}>
      <ProgressBar
        label={resumo}
        value={prontas}
        max={total}
        valueFormatter={(v, m) => `${v} de ${m} com imagem`}
        variant={aprovadas ? "success" : "brand"}
      />
      <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
        {aprovadas
          ? "As imagens foram aprovadas e não mudam mais: é isto que a turma vê no jornal."
          : "As imagens são geradas por inteligência artificial e só aparecem para a turma depois do seu OK. Confira cada uma junto da notícia; se uma não servir, use “Refazer imagem”. A que faltar aparece com uma ilustração da missão."}
      </p>

      {podeEditar && !aprovadas ? (
        <div className="flex flex-wrap items-center gap-3">
          {prontas < total ? (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Icon name="image" size={18} />}
              onClick={() => void gerar()}
              isDisabled={ocupado}
              data-acao="gerar-imagens"
            >
              {gerando ? "Gerando imagens…" : prontas > 0 ? "Gerar as que faltam" : "Gerar imagens"}
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icon name="check" size={18} />}
            onClick={() => void aprovar()}
            isDisabled={ocupado}
            isLoading={aprovando}
            data-acao="aprovar-imagens"
          >
            {COPY_DO_PREPARO.aprovarImagens}
          </Button>
        </div>
      ) : null}
      {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="As imagens do pacote">
        {CHAVES_DAS_IMAGENS.map((chave) => {
          const { descricao, alt, manchete } = descricaoDe(chave);
          const url = imagens[chave];
          const destaque = chave === SUPORTE_OMITIDO;
          const gerandoEsta = refazendo === chave || (gerando && !url);
          return (
            <li
              key={chave}
              className={`flex flex-col gap-2 rounded-lg border p-3 ${
                destaque ? "border-2 border-dashed border-unooria-neutral-950" : "border-unooria-neutral-200"
              }`}
              data-imagem={chave}
              data-destaque={destaque ? "sim" : undefined}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-unooria-neutral-600">
                  {chave === "cartaz" ? ROTULO_DA_IMAGEM.cartaz : ROTULO_DO_SUPORTE[chave]}
                </span>
                {aprovadas ? (
                  <Tag variant="success" size="sm">
                    Aprovada
                  </Tag>
                ) : null}
              </div>
              {manchete ? <p className="text-[14px] font-semibold leading-snug text-unooria-neutral-950">{manchete}</p> : null}
              {/* O quadro tem a proporção da foto do jornal (4:3). É MEDIDA, não componente. */}
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-unooria-neutral-100">
                {gerandoEsta ? (
                  <span className="flex items-center gap-1 text-[11px] text-unooria-neutral-600" role="status">
                    <Icon name="hourglass_top" size={16} /> Gerando…
                  </span>
                ) : url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={alt} className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-[11px] leading-snug text-unooria-neutral-600">
                    Sem imagem: a turma vê uma ilustração da missão
                  </span>
                )}
              </div>
              {destaque ? (
                <p className="text-[12px] font-semibold leading-snug text-unooria-neutral-950" data-destaque-do-telao>
                  {COPY_DO_PREPARO.destaqueDoTelao}
                </p>
              ) : null}
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                <span className="font-semibold">O que a imagem deve mostrar:</span> {descricao}
              </p>
              {podeEditar && !aprovadas && !gerandoEsta ? (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Icon name="refresh" size={16} />}
                    onClick={() => void refazer(chave)}
                    isDisabled={ocupado}
                    aria-label={`${COPY_DO_PREPARO.refazerImagem}: ${ROTULO_DA_IMAGEM[chave]}`}
                    data-acao="refazer-imagem"
                  >
                    {COPY_DO_PREPARO.refazerImagem}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
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
