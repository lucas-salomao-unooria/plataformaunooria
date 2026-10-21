"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, ProgressBar, Tag } from "@edu/ui/ds";
import {
  LAMINAS,
  ROTULO_DA_LAMINA,
  caminhoDaTurma,
  chaveDaMidia,
  continuarGerando,
  erroDaResposta,
  estadoDaImagem,
  estandesPorArea,
  falhasAcumuladas,
  laminasSemImagem,
  rotuloCurtoDaArea,
  rotuloDaAbaDaArea,
  textoDoProgressoDaMidia,
  type ConteudoDoPacote,
  type EstadoDaImagem,
  type ImagemRefeita,
  type ImagensAprovadas,
  type Lamina,
  type ProgressoDaMidia,
  type ProjetoDoPacote,
} from "@/lib/juri-estadual-tipos";

import { AbasDasAreas } from "./estande-do-preparo";

const SEM_CONEXAO = "A conexão falhou. Tente de novo.";

const ROTULO_DO_ESTADO: Record<EstadoDaImagem, { texto: string; variante: "success" | "warning" | "neutral" }> = {
  aprovada: { texto: "Aprovada", variante: "success" },
  aguardando: { texto: "Aguardando seu OK", variante: "warning" },
  gerando: { texto: "Gerando…", variante: "neutral" },
  "sem-imagem": { texto: "Sem imagem: arte desenhada", variante: "neutral" },
};

/**
 * AS IMAGENS DOS ESTANDES de UMA atividade do Júri Estadual — geradas por IA,
 * VISTAS e APROVADAS pelo professor antes de a turma as ver (o pedido do PO:
 * "o professor não consegue validar as imagens dos estandes"). Antes havia só
 * uma barra de progresso: as imagens iam para o feed das crianças sem que
 * ninguém as tivesse visto. Molde: `imagens-do-pacote.tsx` (Jornal, ADR-147),
 * com a aprovação da exp07ef1b (ADR-146) — UM carimbo para o pacote.
 *
 * - "Gerar imagens" é o laço de sempre (`continuarGerando`): a api gera até
 *   oito por chamada, porque o BFF corta e as cento e sessenta não cabem numa
 *   — levam vários minutos (aceito pelo Lucas, 2026-10-14).
 *   `?pacoteId=` diz qual atividade — a pronta também, que ainda não está no ar.
 * - Cada estande aparece com as QUATRO imagens do carrossel do post (0.8.0,
 *   ADR-178: a foto do estande, o projeto de perto, a equipe e os bastidores),
 *   o título e o que a foto deveria mostrar, numa ABA por área
 *   (`AbasDasAreas`; o rótulo diz quantos estandes têm imagem faltando);
 *   "Gerar outra" troca só aquela lâmina (arquivo novo, sempre pago). O total é
 *   o do PACOTE: o de dezesseis da 0.4.x continua abrindo.
 * - "Aprovar as imagens" é a SEGUNDA fase. Ela não exige imagem em todo
 *   estande: o que falhou fica com a arte desenhada, e a grade diz qual é
 *   ANTES do clique. Aprovadas, as imagens congelam (a api responde 409
 *   `imagens-ja-aprovadas` a gerar e a refazer), e só então a atividade vai ao
 *   ar (sem isto, 409 `imagens-nao-aprovadas`).
 *
 * Mora em DOIS lugares: a página da atividade e a fase 2 da CRIAÇÃO
 * (`atividades/nova/criar-juri-estadual.tsx`), onde gera sozinha ao abrir
 * (`gerarAoAbrir`), conta ao assistente quando as imagens estão aprovadas
 * (`aoMudarAprovacao`) e não relê a página — não há página a reler ali.
 */
export function ImagensDoJuri({
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
  imagensIniciais: Readonly<Record<string, string>>;
  /** O carimbo da segunda fase; `null` = as imagens ainda estão em validação. */
  aprovadasEmInicial: string | null;
  /** Só o professor gera e aprova; a coordenação vê a grade. */
  podeEditar: boolean;
  /** Gera as que faltam assim que monta (a fase 2 da criação, logo depois de aprovar os textos). */
  gerarAoAbrir?: boolean;
  /** `true` quando as imagens estão aprovadas e nada está gerando. Com ela, a página não é relida. */
  aoMudarAprovacao?: (aprovadas: boolean) => void;
  /** Dentro do cartão da criação, sem o `Card` próprio. */
  moldura?: boolean;
}) {
  const router = useRouter();
  const [, transicionar] = useTransition();
  const [imagens, setImagens] = useState<Record<string, string>>({ ...imagensIniciais });
  const [aprovadasEm, setAprovadasEm] = useState<string | null>(aprovadasEmInicial);
  const [falhas, setFalhas] = useState<string[]>([]);
  const [gerando, setGerando] = useState(false);
  const [refazendo, setRefazendo] = useState<ReadonlySet<string>>(new Set());
  const [aprovando, setAprovando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /* A página relida (`router.refresh`) é a verdade: outra aba pode ter gerado
     ou aprovado no meio. Sem isto o `useState` ficaria com a primeira leitura. */
  useEffect(() => {
    setImagens({ ...imagensIniciais });
    setAprovadasEm(aprovadasEmInicial);
  }, [imagensIniciais, aprovadasEmInicial]);

  /* O laço pode estar no meio quando a página muda: sem isto ele seguiria
     gastando a quota. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const base = `/api/plataforma${caminhoDaTurma(turmaId)}`;
  const projetos = conteudo.projetos;
  /* Contado por LÂMINA: quatro imagens por estande. */
  const chaves = projetos.flatMap((p) => LAMINAS.map((l) => chaveDaMidia(p.id, l)));
  const total = chaves.length;
  const prontas = chaves.filter((c) => imagens[c]).length;
  const semImagem = total - prontas;
  const aprovadas = aprovadasEm !== null;
  const ocupado = gerando || aprovando || refazendo.size > 0;
  const completas = total > 0 && prontas >= total;

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
    let acumuladas = falhas;
    /* Teto de voltas por precaução: `continuarGerando` já para quando uma
       chamada não anda, e cada volta faz até oito imagens. */
    const tetoDeVoltas = Math.max(total, 1) + 2;
    try {
      for (let volta = 0; volta < tetoDeVoltas && vivo.current; volta += 1) {
        const r = await fetch(`${base}/gerar-midia?pacoteId=${encodeURIComponent(pacoteId)}`, { method: "POST" });
        if (!r.ok) {
          /* 429 `sem-saldo-de-ia` ou o provedor fora: a mensagem da api já está
             na voz certa, e o estande sem imagem segue com a arte desenhada. */
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

  async function refazer(projetoId: string, lamina: Lamina) {
    const chave = chaveDaMidia(projetoId, lamina);
    setRefazendo((atual) => new Set(atual).add(chave));
    setAviso(null);
    try {
      const r = await fetch(
        `${base}/pacotes/${encodeURIComponent(pacoteId)}/imagens/${encodeURIComponent(projetoId)}/refazer?lamina=${lamina}`,
        { method: "POST" },
      );
      if (!r.ok) {
        setAviso(
          erroDaResposta(await r.json().catch(() => null), "Não deu para gerar outra imagem agora. Tente de novo.").mensagem,
        );
        return;
      }
      const nova = (await r.json()) as ImagemRefeita;
      if (!vivo.current) return;
      setImagens((atual) => ({ ...atual, [nova.chave]: nova.url }));
      setFalhas((atual) => atual.filter((c) => c !== nova.chave));
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) {
        setRefazendo((atual) => {
          const sem = new Set(atual);
          sem.delete(chave);
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
      const r = await fetch(`${base}/pacotes/${encodeURIComponent(pacoteId)}/aprovar-imagens`, { method: "POST" });
      if (!r.ok) {
        setAviso(
          erroDaResposta(await r.json().catch(() => null), "Não deu para aprovar as imagens agora. Tente de novo.").mensagem,
        );
        return;
      }
      const resposta = (await r.json()) as ImagensAprovadas;
      if (!vivo.current) return;
      setAprovadasEm(resposta.imagensAprovadasEm);
    } catch {
      setAviso(SEM_CONEXAO);
    } finally {
      if (vivo.current) setAprovando(false);
      reler();
    }
  }

  /* A fase 2 da criação começa gerando: os textos acabaram de ser aprovados, e
     esperar outro clique seria o professor procurar o que fazer. As herdadas
     (a mesma descrição num pacote anterior da turma) já vêm prontas. */
  const comecou = useRef(false);
  useEffect(() => {
    if (comecou.current || !gerarAoAbrir || !podeEditar || aprovadasEmInicial) return;
    comecou.current = true;
    if (chaves.some((c) => !imagensIniciais[c])) void gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez, ao montar
  }, []);

  /** O estado de UMA lâmina. */
  function estadoDaLamina(chave: string): EstadoDaImagem {
    return estadoDaImagem({
      temImagem: Boolean(imagens[chave]),
      gerando: refazendo.has(chave) || (gerando && !imagens[chave]),
      aprovadas,
    });
  }

  /** O estado do ESTANDE: gerando se alguma lâmina gera; "sem imagem" se alguma falta. */
  function estadoDe(projetoId: string): EstadoDaImagem {
    const estados = LAMINAS.map((l) => estadoDaLamina(chaveDaMidia(projetoId, l)));
    if (estados.includes("gerando")) return "gerando";
    if (estados.includes("sem-imagem")) return "sem-imagem";
    return aprovadas ? "aprovada" : "aguardando";
  }

  const resumo = aprovadas
    ? semImagem === 0
      ? `As ${total} imagens estão aprovadas.`
      : `Imagens aprovadas. ${semImagem === 1 ? "1 imagem segue" : `${semImagem} imagens seguem`} com a arte desenhada.`
    : textoDoProgressoDaMidia({ total, prontas });

  const grade = (
    <div
      className="flex flex-col gap-4"
      data-imagens-do-juri
      data-pacote-das-imagens={pacoteId}
      data-imagens-aprovadas={aprovadas ? "sim" : "nao"}
    >
      <div className="flex flex-col gap-2">
        <ProgressBar
          label={resumo}
          value={prontas}
          max={Math.max(total, 1)}
          valueFormatter={(v, m) => `${v} de ${m} com imagem`}
          variant={aprovadas ? "success" : "brand"}
          data-progresso-midia
        />
        <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">
          {aprovadas
            ? "As imagens foram aprovadas e não mudam mais: é isto que a turma vê no feed e na Galeria Oculta."
            : `As imagens são geradas por inteligência artificial e só aparecem para a turma depois do seu OK. Cada estande tem quatro, as fotos do carrossel do post: a foto do estande, o projeto de perto, a equipe e os bastidores. Confira cada uma junto do estande, área por área; se uma não combinar, use “Gerar outra”. Imagem que faltar aparece com uma arte desenhada. Elas saem oito por vez, e as ${total} levam vários minutos: faça antes da aula, e deixe esta tela aberta enquanto geram.`}
        </p>
      </div>

      {podeEditar && !aprovadas ? (
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
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icon name="check" size={18} />}
            onClick={() => void aprovar()}
            isDisabled={ocupado}
            isLoading={aprovando}
            data-acao="aprovar-imagens"
          >
            Aprovar as imagens
          </Button>
          {semImagem > 0 && !gerando ? (
            <span className="text-[12px] leading-snug text-unooria-neutral-600" role="status" data-sem-imagem={semImagem}>
              {semImagem === 1 ? "1 imagem falta" : `${semImagem} imagens faltam`} e{" "}
              {semImagem === 1 ? "ficará" : "ficarão"} com a arte desenhada se você aprovar agora.
            </span>
          ) : null}
        </div>
      ) : null}

      {falhas.length > 0 && !gerando && !aprovadas ? (
        <p className="text-[12px] leading-snug text-unooria-neutral-700" role="status">
          {falhas.length === 1 ? "1 imagem não foi gerada." : `${falhas.length} imagens não foram geradas.`} Tente
          de novo no cartão do estande, ou aprove assim: ela aparece com a arte desenhada.
        </p>
      ) : null}
      {aviso ? <FeedbackAlert type="warning" description={aviso} /> : null}

      <AbasDasAreas
        rotulo="As imagens dos estandes, por área"
        abas={estandesPorArea(conteudo).map(({ categoria, projetos: daArea }) => ({
          area: categoria.area,
          rotulo: rotuloDaAbaDaArea(categoria.nome, daArea.length, {
            quantos: daArea.filter((p) => laminasSemImagem(p.id, imagens) > 0).length,
            texto: "com imagem faltando",
          }),
          conteudo: (
            <section className="flex flex-col gap-2" data-area-das-imagens={categoria.area}>
              <span className="text-[13px] font-semibold text-unooria-neutral-950">
                {rotuloCurtoDaArea(categoria.area)} — {categoria.nome}
              </span>
              <ul className="grid gap-3 lg:grid-cols-2" aria-label={`As imagens da ${rotuloCurtoDaArea(categoria.area)}`}>
                {daArea.map((p) => {
                  const estado = estadoDe(p.id);
                  const faltam = laminasSemImagem(p.id, imagens);
                  const rotulo =
                    estado === "sem-imagem" && faltam < LAMINAS.length
                      ? { texto: `${faltam} de ${LAMINAS.length} sem imagem`, variante: "neutral" as const }
                      : ROTULO_DO_ESTADO[estado];
                  return (
                    <li
                      key={p.id}
                      className="flex flex-col gap-2 rounded-lg border border-unooria-neutral-200 p-3"
                      data-imagem-do-estande={p.id}
                      data-estado-da-imagem={estado}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold leading-snug text-unooria-neutral-950">{p.titulo}</p>
                        <Tag variant={rotulo.variante} size="sm">
                          {rotulo.texto}
                        </Tag>
                      </div>
                      <p className="text-[12px] leading-snug text-unooria-neutral-600">
                        <span className="font-semibold">O que a foto do estande deve mostrar:</span> {p.imagem.descricao}
                      </p>

                      <ul className="grid grid-cols-2 gap-2" aria-label={`As quatro imagens do carrossel de ${p.titulo}`}>
                        {LAMINAS.map((lamina) => (
                          <LaminaDoEstande
                            key={lamina}
                            projeto={p}
                            lamina={lamina}
                            url={imagens[chaveDaMidia(p.id, lamina)]}
                            estado={estadoDaLamina(chaveDaMidia(p.id, lamina))}
                            podeRefazer={podeEditar && !aprovadas}
                            ocupado={ocupado}
                            aoRefazer={() => void refazer(p.id, lamina)}
                          />
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
        }))}
      />
    </div>
  );

  return moldura ? (
    <Card variant="outlined" title="Imagens dos estandes">
      {grade}
    </Card>
  ) : (
    grade
  );
}

/** UMA lâmina do carrossel no cartão do estande: a imagem, o nome dela e o "Gerar outra". */
function LaminaDoEstande({
  projeto,
  lamina,
  url,
  estado,
  podeRefazer,
  ocupado,
  aoRefazer,
}: {
  projeto: ProjetoDoPacote;
  lamina: Lamina;
  url: string | undefined;
  estado: EstadoDaImagem;
  podeRefazer: boolean;
  ocupado: boolean;
  aoRefazer: () => void;
}) {
  const alt = lamina === "capa" ? projeto.imagem.alt : `${ROTULO_DA_LAMINA[lamina]}: ${projeto.titulo}`;
  return (
    <li className="flex flex-col gap-1" data-lamina={lamina} data-estado-da-lamina={estado}>
      {/* O quadro tem a proporção da foto do post (4:3). É MEDIDA, não componente. */}
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-md bg-unooria-neutral-100">
        {estado === "gerando" ? (
          <span className="flex items-center gap-1 text-[11px] text-unooria-neutral-600" role="status">
            <Icon name="hourglass_top" size={16} /> Gerando…
          </span>
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <span className="px-2 text-center text-[11px] leading-snug text-unooria-neutral-600">
            Sem imagem: a turma vê uma arte desenhada
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-[12px] font-semibold text-unooria-neutral-800">{ROTULO_DA_LAMINA[lamina]}</span>
        {podeRefazer && estado !== "gerando" ? (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icon name="refresh" size={16} />}
            onClick={aoRefazer}
            isDisabled={ocupado}
            aria-label={`${url ? "Gerar outra imagem" : "Tentar gerar a imagem"}: ${ROTULO_DA_LAMINA[lamina]}, ${projeto.titulo}`}
            data-acao="gerar-outra-imagem"
          >
            {url ? "Gerar outra" : "Tentar gerar"}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
