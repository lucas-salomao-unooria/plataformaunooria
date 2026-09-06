import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Collapse, FeedbackAlert, Icon, SectionHeader, Tag } from "@edu/ui/ds";

import { api } from "../lib/api";
import type {
  CalendarioDoAno,
  Configuracao,
  Distribuicao,
  Habilidade,
  HabilidadesDoComponente,
  PlanoAnual,
} from "../lib/tipos";
import { dataCurta } from "../lib/tipos";

/**
 * PASSO 2 — A DISTRIBUIÇÃO. O coração pedagógico do produto.
 *
 * O professor decide QUAL habilidade cai em QUAL período de avaliação. Essa
 * decisão é humana de propósito: é ela que expressa a leitura que o professor
 * faz da própria turma, e é a única coisa aqui que nenhum modelo deveria
 * escolher por ele. A IA vem depois, para desenvolver o que ele decidiu.
 *
 * Três coisas que a tela precisa fazer, e que a maioria dos planejadores não faz:
 *
 * 1. AGRUPAR pelo organizador correto. A BNCC não é uniforme: sete componentes
 *    usam unidade temática, Língua Portuguesa usa prática de linguagem, Língua
 *    Inglesa usa eixo, e o Ensino Médio agrupa por competência específica. O
 *    servidor manda o rótulo certo; chamar tudo de "unidade temática" faria o
 *    professor de Português não reconhecer o próprio currículo.
 *
 * 2. Mostrar o que ficou DE FORA. Uma habilidade não distribuída é currículo
 *    não cumprido, e é o erro que só aparece na avaliação externa. O contador
 *    de pendentes fica visível o tempo todo.
 *
 * 3. Mostrar quantas AULAS cada período tem. Distribuir 30 habilidades num
 *    bimestre de 20 aulas é uma decisão que o professor pode tomar — desde que
 *    veja o número antes.
 */

interface Props {
  configuracao: Configuracao;
  plano: PlanoAnual;
  onSalvo: (p: PlanoAnual) => void;
  onAvancar: () => void;
  onVoltar: () => void;
}

export function PassoDistribuicao({ configuracao, plano, onSalvo, onAvancar, onVoltar }: Props) {
  const [curriculo, setCurriculo] = useState<HabilidadesDoComponente | null>(null);
  const [calendario, setCalendario] = useState<CalendarioDoAno | null>(null);
  const [distribuicao, setDistribuicao] = useState<Distribuicao>(plano.distribuicao ?? {});
  const [distCo, setDistCo] = useState<Distribuicao>(plano.distribuicaoComputacao ?? {});
  const [periodoAtivo, setPeriodoAtivo] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [sujo, setSujo] = useState(false);

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      api.get<HabilidadesDoComponente>(
        `/planejamento/curriculo/habilidades?ano=${configuracao.serie}&componente=${configuracao.componente}`,
      ),
      api.get<CalendarioDoAno>(`/planejamento/configuracoes/${configuracao.id}/calendario`),
    ])
      .then(([c, cal]) => {
        if (!ativo) return;
        setCurriculo(c);
        setCalendario(cal);
      })
      .catch(() => ativo && setErro("Não foi possível carregar as habilidades deste componente."));
    return () => {
      ativo = false;
    };
  }, [configuracao.id, configuracao.serie, configuracao.componente]);

  /** Onde cada código já está. Uma habilidade mora em um período só. */
  const alocacao = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const [ordem, codigos] of Object.entries(distribuicao)) {
      for (const c of codigos) mapa.set(c, Number(ordem));
    }
    return mapa;
  }, [distribuicao]);

  const alocacaoCo = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const [ordem, codigos] of Object.entries(distCo)) {
      for (const c of codigos) mapa.set(c, Number(ordem));
    }
    return mapa;
  }, [distCo]);

  const totalDeHabilidades = curriculo?.total ?? 0;
  const distribuidas = alocacao.size;
  const pendentes = totalDeHabilidades - distribuidas;

  function alternar(codigo: string, ehComputacao: boolean) {
    const set = ehComputacao ? setDistCo : setDistribuicao;
    const mapa = ehComputacao ? alocacaoCo : alocacao;
    setSujo(true);
    set((atual) => {
      const copia: Distribuicao = {};
      // Reconstrói sem o código: a habilidade sai de onde estivesse antes de
      // entrar aqui. Sem isso ela apareceria em dois bimestres, e o plano anual
      // a desenvolveria duas vezes como se fossem coisas diferentes.
      for (const [ordem, codigos] of Object.entries(atual)) {
        const restantes = codigos.filter((c) => c !== codigo);
        if (restantes.length) copia[ordem] = restantes;
      }
      if (mapa.get(codigo) !== periodoAtivo) {
        const chave = String(periodoAtivo);
        copia[chave] = [...(copia[chave] ?? []), codigo];
      }
      return copia;
    });
  }

  /** Distribui as habilidades ainda soltas, em ordem, entre os períodos. */
  function sugerirDistribuicao() {
    if (!curriculo || !calendario) return;
    const periodos = calendario.periodos;
    const soltas = curriculo.grupos
      .flatMap((g) => g.habilidades.map((h) => h.codigo))
      .filter((c) => !alocacao.has(c));
    if (!soltas.length) return;

    setSujo(true);
    setDistribuicao((atual) => {
      const copia: Distribuicao = { ...atual };
      // Proporcional às AULAS de cada período, não ao número de períodos: o
      // último trimestre tem 14 semanas e os outros 13, e um bimestre com
      // feriado tem menos aula que os demais.
      const totalDeAulas = periodos.reduce((t, p) => t + p.aulasEstimadas, 0) || 1;
      let indice = 0;
      periodos.forEach((p, i) => {
        const fatia =
          i === periodos.length - 1
            ? soltas.length - indice
            : Math.round((p.aulasEstimadas / totalDeAulas) * soltas.length);
        const pedaco = soltas.slice(indice, indice + fatia);
        indice += fatia;
        if (pedaco.length) {
          copia[String(p.ordem)] = [...(copia[String(p.ordem)] ?? []), ...pedaco];
        }
      });
      return copia;
    });
  }

  async function salvar(avancar: boolean) {
    setErro(null);
    setSalvando(true);
    try {
      const atualizado = await api.put<PlanoAnual>(
        `/planejamento/planos-anuais/${plano.id}/distribuicao`,
        { distribuicao, distribuicaoComputacao: distCo },
      );
      onSalvo(atualizado);
      setSujo(false);
      if (avancar) onAvancar();
    } catch (falha) {
      console.error("[plano-de-ensino] salvar distribuição", falha);
      setErro("Não foi possível salvar a distribuição.");
    } finally {
      setSalvando(false);
    }
  }

  if (!curriculo || !calendario) {
    return <p aria-live="polite">Carregando as habilidades da BNCC…</p>;
  }

  const periodos = calendario.periodos;
  const doPeriodo = distribuicao[String(periodoAtivo)] ?? [];
  const coDoPeriodo = distCo[String(periodoAtivo)] ?? [];
  const periodo = periodos.find((p) => p.ordem === periodoAtivo);

  return (
    <section className="passo">
      <SectionHeader
        title="O que cai em cada período"
        description={`As ${totalDeHabilidades} habilidades da BNCC de ${curriculo.componenteRotulo}. Escolha o período e marque as habilidades que você vai garantir nele.`}
      />

      {erro && <FeedbackAlert type="error" description={erro} />}

      {curriculo.habilidadesPorArea && (
        <FeedbackAlert
          type="info"
          title="Habilidades da área do conhecimento"
          description="No Ensino Médio a BNCC organiza por área. Estas habilidades são compartilhadas com os outros componentes da mesma área — selecione as que você vai desenvolver na sua disciplina."
        />
      )}

      {/* -------------------------------------------- os períodos, como abas -- */}
      <div className="abas-de-periodo" role="tablist" aria-label="Períodos de avaliação">
        {periodos.map((p) => {
          const qtd = (distribuicao[String(p.ordem)] ?? []).length;
          return (
            <button
              key={p.ordem}
              type="button"
              role="tab"
              aria-selected={p.ordem === periodoAtivo}
              className={`aba-de-periodo${p.ordem === periodoAtivo ? " aba-de-periodo--ativa" : ""}`}
              onClick={() => setPeriodoAtivo(p.ordem)}
            >
              <strong>{p.rotulo}</strong>
              <span>
                {dataCurta(p.inicio)} – {dataCurta(p.fim)}
              </span>
              <span className="aba-de-periodo__numeros">
                {qtd} habilidade{qtd === 1 ? "" : "s"} · {p.aulasEstimadas} aulas
              </span>
            </button>
          );
        })}
      </div>

      <div className="barra-de-resumo">
        <span>
          <strong>{distribuidas}</strong> de {totalDeHabilidades} habilidades distribuídas
        </span>
        {pendentes > 0 ? (
          <Badge variant="warning">
            {pendentes} ainda fora do plano
          </Badge>
        ) : (
          <Badge variant="success">Currículo do ano coberto</Badge>
        )}
        {pendentes > 0 && (
          <Button variant="tertiary" size="sm" onClick={sugerirDistribuicao}>
            Distribuir as pendentes pelos períodos
          </Button>
        )}
      </div>

      {periodo && doPeriodo.length > periodo.aulasEstimadas && (
        <FeedbackAlert
          type="warning"
          description={`${doPeriodo.length} habilidades em ${periodo.aulasEstimadas} aulas neste período. Cabe — habilidades se trabalham juntas e ao longo de várias aulas — mas vale conferir se não está apertado.`}
        />
      )}

      {/* --------------------------------------- as habilidades, agrupadas -- */}
      {curriculo.grupos.map((grupo) => (
        <Collapse
          key={grupo.organizador}
          variant="bordered"
          title={grupo.organizador}
          subtitle={`${curriculo.rotuloDoOrganizador} · ${grupo.habilidades.length} habilidades`}
          defaultOpen={false}
        >
          <ul className="lista-de-habilidades">
            {grupo.habilidades.map((h) => (
              <ItemDeHabilidade
                key={h.codigo}
                habilidade={h}
                periodoAtual={alocacao.get(h.codigo) ?? null}
                periodoAtivo={periodoAtivo}
                onAlternar={() => alternar(h.codigo, false)}
              />
            ))}
          </ul>
        </Collapse>
      ))}

      {/* ------------------------------------- a camada transversal (opt-in) -- */}
      {configuracao.incluirComputacao && curriculo.computacao.length > 0 && (
        <Collapse
          variant="card"
          title="Computação — camada transversal"
          subtitle={`${curriculo.computacao.length} habilidades · ${coDoPeriodo.length} neste período`}
          defaultOpen={false}
        >
          <FeedbackAlert
            type="info"
            description="A articulação entre Computação e o seu componente é proposta pedagógica da escola, não currículo obrigatório: a Resolução CNE/CEB 1/2022 delega às redes definir a abordagem, e não existe mapeamento oficial entre as duas listas."
          />
          <ul className="lista-de-habilidades">
            {curriculo.computacao.map((h) => (
              <ItemDeHabilidade
                key={h.codigo}
                habilidade={h}
                periodoAtual={alocacaoCo.get(h.codigo) ?? null}
                periodoAtivo={periodoAtivo}
                onAlternar={() => alternar(h.codigo, true)}
              />
            ))}
          </ul>
        </Collapse>
      )}

      <div className="acoes">
        <Button variant="secondary" onClick={onVoltar} disabled={salvando}>
          Voltar
        </Button>
        <Button variant="tertiary" onClick={() => void salvar(false)} loading={salvando} disabled={!sujo}>
          Salvar
        </Button>
        <Button
          variant="primary"
          onClick={() => void salvar(true)}
          loading={salvando}
          disabled={distribuidas === 0}
        >
          Escrever o plano anual
        </Button>
      </div>
    </section>
  );
}

function ItemDeHabilidade({
  habilidade,
  periodoAtual,
  periodoAtivo,
  onAlternar,
}: {
  habilidade: Habilidade;
  periodoAtual: number | null;
  periodoAtivo: number;
  onAlternar: () => void;
}) {
  const aqui = periodoAtual === periodoAtivo;
  const noutro = periodoAtual !== null && !aqui;

  return (
    <li className={`habilidade${aqui ? " habilidade--marcada" : ""}`}>
      <button
        type="button"
        className="habilidade__botao"
        aria-pressed={aqui}
        onClick={onAlternar}
        title={noutro ? `Já está no ${periodoAtual}º período — clique para trazer para cá` : undefined}
      >
        <Icon name={aqui ? "check_box" : "check_box_outline_blank"} size="s" />
      </button>
      <div className="habilidade__texto">
        <p className="habilidade__cabecalho">
          <code>{habilidade.codigo}</code>
          {noutro && <Tag variant="neutral">{periodoAtual}º período</Tag>}
        </p>
        <p>{habilidade.descricao}</p>
        {habilidade.objetoDeConhecimento && (
          <p className="habilidade__objeto">{habilidade.objetoDeConhecimento}</p>
        )}
        {/* A Computação traz explicação e exemplos do anexo oficial — texto
            pedagógico que nenhum outro componente da BNCC tem. */}
        {habilidade.explicacao && (
          <details className="habilidade__detalhe">
            <summary>Como trabalhar</summary>
            <p>{habilidade.explicacao}</p>
            {habilidade.exemplos && (
              <p>
                <strong>Exemplos:</strong> {habilidade.exemplos}
              </p>
            )}
          </details>
        )}
      </div>
    </li>
  );
}
