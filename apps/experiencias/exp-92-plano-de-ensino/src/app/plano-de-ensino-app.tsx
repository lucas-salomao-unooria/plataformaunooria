import { useState } from "react";
import { Button, EmptyState, Icon, SectionHeader, Stepper, Tag } from "@edu/ui/ds";

import { api } from "../lib/api";
import type { Configuracao, PlanoAnual } from "../lib/tipos";
import { PassoRegencia } from "./passo-regencia";
import { PassoDistribuicao } from "./passo-distribuicao";
import { PassoAnual } from "./passo-anual";
import { PassoAulas } from "./passo-aulas";

/**
 * A casca da exp-92: as regências do professor e os quatro passos do
 * planejamento.
 *
 * O fluxo é linear de propósito, e a ordem não é arbitrária — é a ordem em que
 * um plano de ensino se constrói numa escola:
 *
 *   REGÊNCIA → DISTRIBUIÇÃO → PLANO ANUAL → AULAS
 *   o que leciono   o que cai     a prosa      o dia a dia
 *                   em cada       pedagógica
 *                   período
 *
 * Cada passo depende do anterior e nenhum pode ser pulado, mas todos podem ser
 * revisitados: em agosto o professor volta à distribuição, remaneja o que não
 * coube e regera o plano do 3º bimestre. Um planejador que só anda para a
 * frente não sobrevive ao primeiro mês de aula real.
 */

const PASSOS = [
  { id: "regencia", label: "Regência", description: "Componente, ano e carga", icon: "tune" },
  { id: "distribuicao", label: "Currículo", description: "Habilidades por período", icon: "checklist" },
  { id: "anual", label: "Plano anual", description: "O documento do ano", icon: "menu_book" },
  { id: "aulas", label: "Aulas", description: "Semana a semana", icon: "event_note" },
];

type Tela = "lista" | "regencia" | "distribuicao" | "anual" | "aulas";
const INDICE: Record<Exclude<Tela, "lista">, number> = {
  regencia: 0,
  distribuicao: 1,
  anual: 2,
  aulas: 3,
};

interface Props {
  professorNome: string;
  configuracoesIniciais: Configuracao[];
}

export function PlanoDeEnsinoApp({ professorNome, configuracoesIniciais }: Props) {
  const [configuracoes, setConfiguracoes] = useState(configuracoesIniciais);
  const [configuracao, setConfiguracao] = useState<Configuracao | null>(null);
  const [plano, setPlano] = useState<PlanoAnual | null>(null);
  const [tela, setTela] = useState<Tela>(configuracoesIniciais.length ? "lista" : "regencia");
  const [abrindo, setAbrindo] = useState(false);

  /**
   * Abrir uma regência busca o plano anual dela, ou cria um. O plano anual é o
   * contêiner de tudo — a distribuição mora nele, e os planos de período
   * penduram nele — então ele existe desde o começo, mesmo vazio.
   */
  async function abrir(c: Configuracao) {
    setAbrindo(true);
    try {
      const { planos } = await api.get<{ planos: PlanoAnual[] }>("/planejamento/planos-anuais");
      const existente = planos.find((p) => p.configuracaoId === c.id);
      const alvo =
        existente ??
        (await api.post<PlanoAnual>(`/planejamento/configuracoes/${c.id}/plano-anual`));
      setConfiguracao(c);
      setPlano(alvo);
      // Vai direto para onde o professor parou: quem já tem plano pronto quer
      // as aulas da semana, não a tela de distribuição de novo.
      setTela(
        alvo.status === "pronto"
          ? "aulas"
          : Object.keys(alvo.distribuicao ?? {}).length
            ? "anual"
            : "distribuicao",
      );
    } finally {
      setAbrindo(false);
    }
  }

  function aoSalvarRegencia(c: Configuracao) {
    setConfiguracoes((atual) => {
      const outras = atual.filter((x) => x.id !== c.id);
      return [c, ...outras];
    });
    void abrir(c);
  }

  return (
    <main className="app-shell app-main">
      <div className="app-conteudo">
        <header className="cabecalho">
          <div>
            <h1>Planejamento de ensino</h1>
            <p>
              {professorNome} · plano anual e plano de aulas a partir da Base Nacional Comum
              Curricular
            </p>
          </div>
          {tela !== "lista" && configuracao && (
            <Button variant="tertiary" size="sm" onClick={() => setTela("lista")}>
              Meus planejamentos
            </Button>
          )}
        </header>

        {tela !== "lista" && (
          <Stepper steps={PASSOS} currentStep={INDICE[tela]} size="sm" fillCompletedConnectors />
        )}

        {/* ----------------------------------------------- 0. os planejamentos -- */}
        {tela === "lista" && (
          <section className="passo">
            <SectionHeader
              title="Meus planejamentos"
              description="Um por componente e ano que você leciona."
              actions={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setConfiguracao(null);
                    setPlano(null);
                    setTela("regencia");
                  }}
                >
                  Novo planejamento
                </Button>
              }
            />

            {configuracoes.length === 0 ? (
              <EmptyState
                title="Nenhum planejamento ainda"
                description="Comece dizendo o que você leciona: o componente, o ano e quantas aulas por semana."
                primaryAction={{
                  label: "Criar o primeiro",
                  onClick: () => setTela("regencia"),
                }}
              />
            ) : (
              <ul className="lista-de-planejamentos">
                {configuracoes.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="planejamento"
                      onClick={() => void abrir(c)}
                      disabled={abrindo}
                    >
                      <span className="planejamento__titulo">
                        <strong>{c.componenteRotulo}</strong>
                        <span>
                          {c.serieRotulo}
                          {c.turmaNome ? ` · ${c.turmaNome}` : ""} · {c.anoLetivo}
                        </span>
                      </span>
                      <span className="planejamento__meta">
                        <Tag variant="neutral">
                          {c.aulasSemanais} aula(s)/semana · {c.dimensionamento.aulasNoAno} no ano
                        </Tag>
                        <Tag variant="neutral">
                          {c.periodicidade === "quinzenal" ? "Quinzenal" : "Semanal"}
                        </Tag>
                        {!c.dimensionamento.gradeCoerente && (
                          <Tag variant="warning">Grade incompleta</Tag>
                        )}
                        <Icon name="chevron_right" size="s" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* -------------------------------------------------------- 1. regência -- */}
        {tela === "regencia" && (
          <PassoRegencia
            configuracao={configuracao}
            onSalvo={aoSalvarRegencia}
            onCancelar={() => setTela(configuracoes.length ? "lista" : "regencia")}
          />
        )}

        {/* --------------------------------------------------- 2. distribuição -- */}
        {tela === "distribuicao" && configuracao && plano && (
          <PassoDistribuicao
            configuracao={configuracao}
            plano={plano}
            onSalvo={setPlano}
            onAvancar={() => setTela("anual")}
            onVoltar={() => setTela("regencia")}
          />
        )}

        {/* ------------------------------------------------------ 3. plano anual -- */}
        {tela === "anual" && configuracao && plano && (
          <PassoAnual
            configuracao={configuracao}
            plano={plano}
            professorNome={professorNome}
            onAtualizado={setPlano}
            onVoltar={() => setTela("distribuicao")}
            onAvancar={() => setTela("aulas")}
          />
        )}

        {/* ------------------------------------------------------------ 4. aulas -- */}
        {tela === "aulas" && configuracao && plano && (
          <PassoAulas
            configuracao={configuracao}
            plano={plano}
            professorNome={professorNome}
            onVoltar={() => setTela("anual")}
          />
        )}
      </div>
    </main>
  );
}
