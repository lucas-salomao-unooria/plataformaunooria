import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Collapse,
  FeedbackAlert,
  Icon,
  ProgressBar,
  SectionHeader,
  Tag,
  TextArea,
  TextField,
  Toggle,
} from "@edu/ui/ds";

import { api, statusDoErro } from "../lib/api";
import { baixarDoc, documentoDoPeriodo, imprimir } from "../lib/exportar";
import type {
  Aula,
  CalendarioDoAno,
  Configuracao,
  Janela,
  PlanoAnual,
  PlanoDePeriodo,
} from "../lib/tipos";
import { DIAS, dataCurta, dataLonga } from "../lib/tipos";

/**
 * PASSO 4 — AS AULAS. O granular, e o que o professor abre toda semana.
 *
 * As aulas são DADO, não prosa: cada uma é um objeto editável, e o documento
 * impresso nasce delas. É o que permite editar a aula de quinta sem tocar na de
 * terça, e é o que faz o plano virar registro — a caixa "aula cumprida" e a
 * observação são preenchidas DEPOIS da aula, e não vêm da IA.
 *
 * O esqueleto (quantas aulas, em que dia, em que horário) vem da grade real do
 * professor, calculado no servidor. O modelo só preenche o conteúdo pedagógico
 * das aulas que existem.
 */

const INTERVALO_POLLING_MS = 3_000;

interface Props {
  configuracao: Configuracao;
  plano: PlanoAnual;
  professorNome: string;
  onVoltar: () => void;
}

export function PassoAulas({ configuracao, plano, professorNome, onVoltar }: Props) {
  const [calendario, setCalendario] = useState<CalendarioDoAno | null>(null);
  const [janelaAtiva, setJanelaAtiva] = useState<Janela | null>(null);
  const [periodo, setPeriodo] = useState<PlanoDePeriodo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  const carregarCalendario = useCallback(async () => {
    const c = await api.get<CalendarioDoAno>(
      `/planejamento/configuracoes/${configuracao.id}/calendario`,
    );
    setCalendario(c);
    return c;
  }, [configuracao.id]);

  useEffect(() => {
    void carregarCalendario().catch(() => setErro("Não foi possível carregar o calendário."));
  }, [carregarCalendario]);

  const carregarPeriodo = useCallback(async (id: string) => {
    const p = await api.get<PlanoDePeriodo>(`/planejamento/periodos/${id}`);
    setPeriodo(p);
    return p.status;
  }, []);

  // Polling enquanto a janela gera.
  useEffect(() => {
    if (periodo?.status !== "gerando") return;
    const t = window.setInterval(() => {
      void carregarPeriodo(periodo.id).then((s) => {
        if (s !== "gerando") void carregarCalendario();
      });
    }, INTERVALO_POLLING_MS);
    return () => window.clearInterval(t);
  }, [periodo?.status, periodo?.id, carregarPeriodo, carregarCalendario]);

  async function abrir(janela: Janela) {
    setJanelaAtiva(janela);
    setPeriodo(null);
    setErro(null);
    setSujo(false);
    if (janela.planoId) await carregarPeriodo(janela.planoId).catch(() => setErro("Falha ao abrir."));
  }

  async function gerar(janela: Janela) {
    setErro(null);
    try {
      const { id } = await api.post<{ id: string }>(
        `/planejamento/planos-anuais/${plano.id}/periodos/${janela.ordem}/gerar`,
        { feriados: [] },
      );
      await carregarPeriodo(id);
    } catch (falha) {
      const codigo = statusDoErro(falha);
      setErro(
        codigo === 403
          ? "A cota diária de IA acabou. Tente novamente amanhã."
          : codigo === 400
            ? "Esta janela não tem aula — confira a grade de horários na regência."
            : "Não foi possível gerar o plano desta janela.",
      );
    }
  }

  function editarAula(numero: number, mudanca: Partial<Aula>) {
    setSujo(true);
    setPeriodo((atual) =>
      atual
        ? { ...atual, aulas: atual.aulas.map((a) => (a.numero === numero ? { ...a, ...mudanca } : a)) }
        : atual,
    );
  }

  async function salvar() {
    if (!periodo) return;
    setSalvando(true);
    try {
      const p = await api.put<PlanoDePeriodo>(`/planejamento/periodos/${periodo.id}/aulas`, {
        aulas: periodo.aulas,
      });
      setPeriodo(p);
      setSujo(false);
    } catch {
      setErro("Não foi possível salvar as aulas.");
    } finally {
      setSalvando(false);
    }
  }

  if (!calendario) return <p aria-live="polite">Carregando o calendário…</p>;

  const rotuloDaJanela = configuracao.periodicidade === "quinzenal" ? "quinzena" : "semana";
  const documento = () =>
    periodo ? documentoDoPeriodo(periodo, configuracao, professorNome) : "";
  const titulo = `${configuracao.componenteRotulo} — ${janelaAtiva?.rotulo ?? ""}`;

  return (
    <section className="passo">
      <SectionHeader
        title="Suas aulas"
        description={`Cada ${rotuloDaJanela} do ano letivo, aula a aula, a partir do que você distribuiu no plano anual.`}
      />

      {erro && <FeedbackAlert type="error" description={erro} />}

      {!janelaAtiva && (
        <>
          {calendario.periodos.map((p) => (
            <Collapse
              key={p.ordem}
              variant="bordered"
              title={p.rotulo}
              subtitle={`${dataCurta(p.inicio)} a ${dataCurta(p.fim)} · ${p.aulasEstimadas} aulas`}
              defaultOpen={p.ordem === 1}
            >
              <ul className="lista-de-janelas">
                {calendario.janelas
                  .filter((j) => j.periodoDeAvaliacao === p.ordem)
                  .map((j) => (
                    <li key={j.ordem}>
                      <button type="button" className="janela" onClick={() => void abrir(j)}>
                        <span className="janela__rotulo">
                          <strong>{j.rotulo}</strong>
                          <span>
                            {dataCurta(j.inicio)} – {dataCurta(j.fim)}
                          </span>
                        </span>
                        <span className="janela__estado">
                          <span>{j.aulasPrevistas} aula(s)</span>
                          {j.status === "pronto" && <Badge variant="success">Planejada</Badge>}
                          {j.status === "gerando" && <Badge variant="info">Gerando…</Badge>}
                          {j.status === "erro" && <Badge variant="error">Falhou</Badge>}
                          {!j.status && <Tag variant="neutral">A planejar</Tag>}
                          <Icon name="chevron_right" size="s" />
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </Collapse>
          ))}
        </>
      )}

      {janelaAtiva && (
        <>
          <div className="acoes acoes--topo">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => {
                setJanelaAtiva(null);
                setPeriodo(null);
                void carregarCalendario();
              }}
            >
              ← Todas as {rotuloDaJanela}s
            </Button>
            {periodo?.status === "pronto" && (
              <>
                <Button variant="tertiary" size="sm" onClick={() => imprimir(documento(), titulo)}>
                  Imprimir
                </Button>
                <Button variant="tertiary" size="sm" onClick={() => baixarDoc(documento(), titulo)}>
                  Baixar .doc
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void gerar(janelaAtiva)}>
                  Gerar de novo
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void salvar()}
                  loading={salvando}
                  disabled={!sujo}
                >
                  {sujo ? "Salvar" : "Salvo"}
                </Button>
              </>
            )}
          </div>

          <h3 className="titulo-da-janela">
            {janelaAtiva.rotulo} · {dataLonga(janelaAtiva.inicio)} a {dataLonga(janelaAtiva.fim)} ·{" "}
            {janelaAtiva.aulasPrevistas} aula(s)
          </h3>

          {!periodo && janelaAtiva.aulasPrevistas === 0 && (
            <FeedbackAlert
              type="warning"
              description="Esta janela não tem aula na sua grade de horários. Confira a regência se isso não estiver certo."
            />
          )}

          {!periodo && janelaAtiva.aulasPrevistas > 0 && (
            <div className="estado-vazio">
              <p>
                Esta {rotuloDaJanela} ainda não foi planejada. O gerador detalha as{" "}
                {janelaAtiva.aulasPrevistas} aulas a partir das habilidades do{" "}
                {janelaAtiva.periodoDeAvaliacao}º período.
              </p>
              <Button variant="primary" onClick={() => void gerar(janelaAtiva)}>
                Planejar estas aulas
              </Button>
            </div>
          )}

          {periodo?.status === "gerando" && (
            <div className="estado-gerando" aria-live="polite">
              <ProgressBar indeterminate />
              <p>Detalhando as aulas…</p>
            </div>
          )}

          {periodo?.status === "erro" && (
            <FeedbackAlert
              type="error"
              description={periodo.erro ?? "A geração falhou."}
              action={<Button size="sm" onClick={() => void gerar(janelaAtiva)}>Tentar de novo</Button>}
            />
          )}

          {periodo?.status === "pronto" &&
            periodo.aulas.map((aula) => (
              <CartaoDeAula
                key={aula.numero}
                aula={aula}
                minutos={configuracao.minutosPorAula}
                onEditar={(m) => editarAula(aula.numero, m)}
              />
            ))}
        </>
      )}

      <div className="acoes">
        <Button variant="secondary" onClick={onVoltar}>
          Voltar ao plano anual
        </Button>
      </div>
    </section>
  );
}

/**
 * Uma aula. Os quatro momentos ficam visíveis por padrão porque são o plano de
 * aula propriamente dito — colapsá-los transformaria a tela numa lista de temas,
 * que é exatamente o que este produto existe para não ser.
 */
function CartaoDeAula({
  aula,
  minutos,
  onEditar,
}: {
  aula: Aula;
  minutos: number;
  onEditar: (m: Partial<Aula>) => void;
}) {
  const dia = DIAS.find((d) => d.valor === aula.diaDaSemana);
  const somaDosMomentos =
    aula.momentos.retomada.minutos +
    aula.momentos.desenvolvimento.minutos +
    aula.momentos.sistematizacao.minutos +
    aula.momentos.fechamento.minutos;

  return (
    <article className={`cartao-de-aula${aula.cumprida ? " cartao-de-aula--cumprida" : ""}`}>
      <header className="cartao-de-aula__cabecalho">
        <div>
          <span className="cartao-de-aula__quando">
            Aula {aula.numero} · {dia?.longo}, {dataCurta(aula.data)} às {aula.horario} · {minutos} min
          </span>
          <TextField
            label="Tema da aula"
            value={aula.tema}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditar({ tema: e.target.value })}
          />
        </div>
        <Toggle
          checked={aula.cumprida}
          onChange={(v) => onEditar({ cumprida: v })}
          label="Aula dada"
          size="xs"
        />
      </header>

      {aula.habilidades.length > 0 && (
        <p className="cartao-de-aula__habilidades">
          {aula.habilidades.map((c) => (
            <Tag key={c} variant="info">
              {c}
            </Tag>
          ))}
        </p>
      )}

      <TextArea
        label="Objetivo desta aula"
        value={aula.objetivo}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ objetivo: e.target.value })}
        rows={2}
      />

      <TextArea
        label="Conteúdo"
        value={aula.conteudo}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ conteudo: e.target.value })}
        rows={2}
      />

      <div className="momentos">
        <p className="momentos__titulo">
          Sequência da aula
          {somaDosMomentos > 0 && (
            <span className={somaDosMomentos > minutos ? "momentos__soma--estourou" : "momentos__soma"}>
              {somaDosMomentos} de {minutos} min
            </span>
          )}
        </p>
        {(
          [
            ["retomada", "Retomada"],
            ["desenvolvimento", "Desenvolvimento"],
            ["sistematizacao", "Sistematização"],
            ["fechamento", "Fechamento"],
          ] as const
        ).map(([chave, rotulo]) => (
          <div key={chave} className="momento">
            <div className="momento__rotulo">
              <strong>{rotulo}</strong>
              <input
                type="number"
                min={0}
                max={120}
                aria-label={`Minutos de ${rotulo}`}
                value={aula.momentos[chave].minutos}
                onChange={(e) =>
                  onEditar({
                    momentos: {
                      ...aula.momentos,
                      [chave]: { ...aula.momentos[chave], minutos: Number(e.target.value) || 0 },
                    },
                  })
                }
              />
              <span>min</span>
            </div>
            <TextArea
              value={aula.momentos[chave].o_que}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                onEditar({
                  momentos: {
                    ...aula.momentos,
                    [chave]: { ...aula.momentos[chave], o_que: e.target.value },
                  },
                })
              }
              rows={2}
              aria-label={`O que acontece em ${rotulo}`}
            />
          </div>
        ))}
      </div>

      <Collapse variant="default" title="Recursos, avaliação e adaptações" defaultOpen={false}>
        {aula.recursos.length > 0 && (
          <p className="cartao-de-aula__recursos">
            {aula.recursos.map((r, i) => (
              <Tag key={i} variant="neutral">
                {r}
              </Tag>
            ))}
          </p>
        )}
        <TextArea
          label="O que observar (avaliação da aula)"
          value={aula.avaliacao}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ avaliacao: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Tarefa de casa"
          value={aula.tarefaDeCasa}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ tarefaDeCasa: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Adaptações"
          value={aula.adaptacoes}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onEditar({ adaptacoes: e.target.value })}
          rows={2}
        />
        <TextArea
          label="Meu registro (depois da aula)"
          value={aula.observacaoDoProfessor}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            onEditar({ observacaoDoProfessor: e.target.value })
          }
          rows={2}
          helperText="O que funcionou, o que ficou para a próxima. Sai no documento impresso."
        />
      </Collapse>
    </article>
  );
}
