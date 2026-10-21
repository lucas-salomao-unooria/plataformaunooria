"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, FeedbackAlert, Icon, MetricCard, ProgressBar } from "@edu/ui/ds";
import {
  GUIA_DA_REFLEXAO,
  PISO_DO_MURAL,
  ROTULO_DA_ETAPA,
  aulaEmAndamento,
  distribuicaoDaSala,
  mudouAEvidencia,
  percentualPublicado,
  rotuloDoBotao,
  textoDoEnvio,
  type ErroDaSelecao,
  type GateDaTurma,
  type MaterialDaSelecao,
  type PainelDaSelecao,
  type PostDaCobertura,
} from "@/lib/a-selecao-tipos";
import { AVISO_POR_COMPUTADOR, type MembroNoPainel } from "@/lib/equipe-no-painel";

import { ListaDaSelecao } from "./lista-da-selecao";

/**
 * O PAINEL DA AULA da exp07ef1b — o botão único, o "X de Y publicaram" e a
 * folha da turma, AO VIVO.
 *
 * **UM botão, e ele diz a etapa de DESTINO.** O rótulo sai de
 * `proximaEtapa`, que a api calcula: Liberar Mural da Turma → Abrir marcação do
 * colega (ADR-170) → Revelar Fichas Técnicas → Liberar Conclusão Individual, e
 * depois nada. Ele avança uma etapa
 * por vez e nunca volta (409 `transicao-de-etapa-invalida`) — são as três
 * pausas do PRD, e a leitura da ADR-108 de que a professora conduz a turma com
 * o mínimo de controles. Não há "voltar" como na exp05ef1b: o Mural pareia a
 * sala na abertura, e desfazer seria desparear quem já viu o colega.
 *
 * **Consulta LEVE, e não `router.refresh()`.** A página desta missão lê cinco
 * rotas (painel, coberturas, guia, equipes, habilidades); refazê-la a cada 5 s
 * seria cinco chamadas por professora durante a aula inteira. Aqui só o
 * PAINEL é consultado, pelo BFF, e só enquanto a aula corre
 * (`aulaEmAndamento`) e a aba está visível. O preparo, acima, é outro
 * componente e não é tocado pela consulta.
 *
 * A exceção é a EVIDÊNCIA (ADR-146): quando muda o que o painel de
 * habilidades mostra (`mudouAEvidencia` — alguém publicou, respondeu as
 * enquetes, concluiu; ou a atividade/rodada trocou), a página é refeita, e o
 * professor vê o nível chegar sem recarregar. Mais uma vez na volta seguinte,
 * porque o Canal A marca DEPOIS de a publicação aparecer no painel (a IA
 * gradua a legenda em seguida): sem a segunda leitura, a célula ficava em
 * "Não avaliado" até a próxima mudança.
 *
 * O dado da página (`inicial`) ainda manda quando ela é refeita de verdade —
 * depois de aprovar uma cobertura ou zerar a turma: o `router.refresh()` desses
 * dois entrega um `inicial` novo, e este painel passa a mostrá-lo.
 */

const INTERVALO_MS = 5_000;

/** `prof.erro.desconectado`/`prof.erro.reconexao` do sheet — com "estudantes" onde o sheet diz "alunos" (glossário da própria missão). */
const CONEXAO_CAIU =
  "Conexão com a sala interrompida. Verifique o sinal de internet da escola. Os envios dos estudantes continuam salvos.";
const CONEXAO_VOLTOU = "Sinal restabelecido. O painel da turma foi sincronizado com sucesso.";

type Conexao = "ok" | "caiu" | "voltou";

export function PainelDaAulaASelecao({
  turmaId,
  inicial,
  gatilhos,
  posts,
  membros,
}: {
  turmaId: string;
  inicial: PainelDaSelecao;
  /** Quando apertar cada botão (`GET /a-selecao/professor/material`). `null` = não carregou. */
  gatilhos: MaterialDaSelecao["gatilhos"] | null;
  posts: readonly PostDaCobertura[];
  membros: Readonly<Record<string, MembroNoPainel[]>>;
}) {
  const [painel, setPainel] = useState(inicial);
  const [inicialVisto, setInicialVisto] = useState(inicial);
  if (inicial !== inicialVisto) {
    setInicialVisto(inicial);
    setPainel(inicial);
  }

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conexao, setConexao] = useState<Conexao>("ok");

  const caminho = `/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/painel`;

  const router = useRouter();
  const [, transicionar] = useTransition();
  const ultimo = useRef(painel);
  useEffect(() => {
    ultimo.current = painel;
  }, [painel]);
  /** A releitura de reforço da volta seguinte (o Canal A chega depois). */
  const reler = useRef(false);

  const atualizar = useCallback(async () => {
    try {
      const r = await fetch(caminho, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const novo = (await r.json()) as PainelDaSelecao;
      const mudou = mudouAEvidencia(ultimo.current, novo);
      setPainel(novo);
      if (mudou || reler.current) transicionar(() => router.refresh());
      reler.current = mudou;
      // "voltou" fica uma volta na tela e some na seguinte.
      setConexao((c) => (c === "caiu" ? "voltou" : "ok"));
    } catch {
      setConexao("caiu");
    }
  }, [caminho, router]);

  const emAndamento = aulaEmAndamento(painel);
  useEffect(() => {
    if (!emAndamento) return;
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void atualizar();
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [emAndamento, atualizar]);

  const proxima = painel.proximaEtapa;
  const rotulo = rotuloDoBotao(proxima);
  const { resumo } = painel;
  const percentual = percentualPublicado(resumo.computadores);
  const distribuicao = distribuicaoDaSala(resumo.distribuicaoMedia, resumo.publicaram);
  const gatilho = proxima && proxima !== "exploracao" ? gatilhos?.[proxima] ?? null : null;

  async function avancar() {
    if (!proxima) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/plataforma/a-selecao/turmas/${encodeURIComponent(turmaId)}/gate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ para: proxima }),
      });
      if (!r.ok) {
        /* 409 `transicao-de-etapa-invalida`: outra aba (ou outra pessoa)
           avançou antes. A frase da api diz isso; o painel relê e mostra onde
           a turma está de verdade. */
        const corpo = (await r.json().catch(() => ({}))) as ErroDaSelecao;
        setErro(corpo.mensagem ?? "Não deu para mudar a etapa agora.");
        await atualizar();
        return;
      }
      const gate = (await r.json()) as GateDaTurma;
      setPainel((p) => ({ ...p, etapa: gate.etapa, proximaEtapa: gate.proximaEtapa }));
      // O Mural acabou de parear a sala: a folha precisa dos pares novos.
      await atualizar();
    } catch {
      setErro("A conexão falhou. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Card variant="elevated" title="A aula">
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-unooria-neutral-700" data-etapa={painel.etapa}>
            Agora: <strong className="text-unooria-neutral-950">{ROTULO_DA_ETAPA[painel.etapa]}</strong>
            {painel.rodada > 1 ? (
              <span className="text-unooria-neutral-500"> · rodada {painel.rodada}</span>
            ) : null}
          </p>

          <div className="flex flex-col gap-2">
            <ProgressBar
              label={textoDoEnvio(resumo.computadores, resumo.porComputador)}
              value={resumo.computadores.publicaram}
              max={Math.max(resumo.computadores.total, 1)}
              valueFormatter={() => `${percentual}%`}
              variant={percentual >= PISO_DO_MURAL ? "success" : "brand"}
              data-envio
            />
            {painel.etapa === "marcacao" ? (
              <p className="text-[13px] text-unooria-neutral-700" data-marcaram>
                <strong className="text-unooria-neutral-950">
                  {resumo.marcaram} de {resumo.computadores.publicaram}
                </strong>{" "}
                marcaram o post do colega.
              </p>
            ) : null}
            {proxima === "mural" ? (
              <p className="text-[12px] leading-snug text-unooria-neutral-600">
                {percentual >= PISO_DO_MURAL
                  ? "Já são 80% ou mais: pode liberar o Mural. Quem ainda não publicou continua no feed e ganha o par quando publicar."
                  : "Espere cerca de 80% antes de liberar o Mural. Quem publicar depois ainda entra, com um par na hora — mas chega atrasado à conversa."}
              </p>
            ) : null}
          </div>

          {rotulo ? (
            <div className="flex flex-col gap-1">
              <div>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Icon name="arrow_forward" size={18} />}
                  onClick={() => void avancar()}
                  isDisabled={enviando}
                  data-gate={proxima}
                >
                  {enviando ? "Mudando…" : rotulo}
                </Button>
              </div>
              {/* O `prof.gatilho.*` do sheet, servido pela api junto do guia: é a
                  frase que diz QUANDO apertar, e ela muda sem republicar o hub. */}
              {gatilho ? (
                <p className="max-w-3xl text-[12px] leading-snug text-unooria-neutral-600">{gatilho}</p>
              ) : null}
              <p className="text-[12px] leading-snug text-unooria-neutral-500">
                A turma inteira avança junto, e o botão não volta.
              </p>
            </div>
          ) : (
            <p className="text-[13px] leading-snug text-unooria-neutral-700">
              Todas as etapas estão abertas. Cada um segue no próprio ritmo pelos cards, pela reflexão
              e pelas enquetes. Para aplicar de novo, use Zerar a turma, mais abaixo.
            </p>
          )}

          {erro ? <FeedbackAlert type="error" description={erro} /> : null}
          {conexao === "caiu" ? <FeedbackAlert type="warning" description={CONEXAO_CAIU} /> : null}
          {conexao === "voltou" ? <FeedbackAlert type="success" description={CONEXAO_VOLTOU} /> : null}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title={resumo.porComputador ? "Computadores que publicaram" : "Publicaram os Stories"}
          value={`${resumo.computadores.publicaram}/${resumo.computadores.total}`}
        />
        <MetricCard
          title="Entregaram a reflexão"
          value={`${resumo.entregaram}/${resumo.computadores.total}`}
        />
        <MetricCard title="Marcaram o post do colega" value={`${resumo.marcaram}/${resumo.computadores.publicaram}`} />
        <MetricCard title="Concluíram" value={`${resumo.concluiram}/${resumo.computadores.total}`} />
      </div>
      {distribuicao || resumo.porComputador ? (
        <p className="-mt-2 text-[12px] leading-snug text-unooria-neutral-600" data-distribuicao>
          {distribuicao}
          {distribuicao && resumo.porComputador ? " · " : null}
          {resumo.porComputador ? AVISO_POR_COMPUTADOR : null}
        </p>
      ) : null}

      <Card
        variant="elevated"
        title={[painel.turma.nome, painel.turma.serie].filter(Boolean).join(" · ")}
      >
        <div className="mb-3 flex flex-col gap-1 text-[12px] leading-snug text-unooria-neutral-600">
          <p>
            Esta folha é para a <strong>sua</strong> tela, não para o projetor: ela tem nome, legenda
            e reflexão. Não há coluna de nível nem de acerto — o nível da EF07CO11 fica no painel de
            habilidades, lá embaixo, com a sua confirmação.
          </p>
          <p>
            <strong>Oficial</strong> é a @folhaoficial_, <strong>Comunitária</strong> a @voz_coletiva e{" "}
            <strong>Números</strong> a @metrica_urbana — a mesma divisão que o gráfico da ficha
            técnica mostra à turma.
          </p>
        </div>
        {/* O guia de leitura da reflexão (ADR-170): ela segue SEM nível, como texto
            formativo, e estas três perguntas ajudam a ler o que a turma escreveu. */}
        <div className="flex flex-col gap-1 text-[12px] leading-snug text-unooria-neutral-600" data-guia-da-reflexao>
          <strong className="text-unooria-neutral-800">{GUIA_DA_REFLEXAO.titulo}</strong>
          <ul className="list-disc pl-5">
            {GUIA_DA_REFLEXAO.perguntas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
        <ListaDaSelecao
          linhas={painel.linhas}
          porComputador={resumo.porComputador}
          posts={posts}
          membros={membros}
        />
      </Card>
    </>
  );
}
