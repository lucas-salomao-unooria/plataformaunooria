import { AlertBox, Avatar, Button, MetricCard, SectionHeader, Table, Tabs, Tag } from "@edu/ui/ds";
import type { TableColumn } from "@edu/ui/ds";

import { ordenarRanking, posicaoDoAluno } from "../../lib/ranking";
import type { Aparencia } from "../../lib/tema";
import type { ModoRanking, RankingLinha, RespostaRanking } from "../../lib/tipos";

interface Props {
  ranking: RespostaRanking | null;
  modo: ModoRanking;
  credibilidadeAdicionada: boolean;
  aparencia: Aparencia;
  avatar: string;
  inscritos: number;
  fontesConfiaveis: number;
  limite: number;
  aoOrdenar: (modo: ModoRanking) => void;
  aoAdicionarCredibilidade: () => void;
}

/**
 * O clímax da missão: o ranking abre por inscritos (quem escolheu fake vence);
 * "Adicionar credibilidade" revela a coluna de fontes confiáveis e a métrica
 * vira. As 39 outras linhas são colegas fictícios — vêm prontas da api.
 *
 * ESTA TELA É A ÚNICA DA EXPERIÊNCIA QUE USA O DS DA PLATAFORMA (`@edu/ui/ds`)
 * em vez do clone (`@edu/ui/ds-unootube`). É deliberado e é a regra que o
 * `ds.ts` já descreve: o clone vale enquanto o aluno acha que está num app de
 * vídeo; a partir da revelação ele está de volta na Unooria, e a troca de
 * linguagem visual é parte do que a missão ensina. As duas seções não colidem
 * porque os namespaces são distintos (`--unooria-*` contra `--uni-*`).
 *
 * `theme` acompanha a aparência escolhida pelo aluno: a seção da plataforma
 * não lê `data-uni-theme`, ela recebe o tema por prop.
 */
export function Ranking(props: Props) {
  const { ranking, modo, credibilidadeAdicionada, limite } = props;
  const tema = props.aparencia === "escuro" ? "dark" : "light";
  const linhas = ranking ? ordenarRanking(ranking.linhas, modo) : [];
  const posicao = ranking ? posicaoDoAluno(ranking.linhas, modo) : 0;

  const colunas: TableColumn<RankingLinha>[] = [
    {
      key: "posicao",
      title: "Posição",
      width: 96,
      render: (_valor, _linha, indice) => `${indice + 1}º`,
    },
    {
      key: "nome",
      title: "Aluno",
      minWidth: 220,
      render: (_valor, linha) => (
        <span className="ranking-student">
          <Avatar size="sm" name={linha.nome} theme={tema} />
          <strong>{linha.nome}</strong>
          {linha.voce && (
            <Tag variant="brand" size="sm" pill theme={tema}>
              Você
            </Tag>
          )}
        </span>
      ),
    },
    {
      key: "inscritos",
      title: "Inscritos",
      align: "right",
      width: 150,
      render: (_valor, linha) => linha.inscritos.toLocaleString("pt-BR"),
    },
    ...(credibilidadeAdicionada
      ? [
          {
            key: "fontesConfiaveis",
            title: "Fontes confiáveis",
            align: "right" as const,
            width: 170,
            render: (_valor: unknown, linha: RankingLinha) => (
              <Tag variant="success" size="sm" theme={tema}>
                {linha.fontesConfiaveis}/{limite}
              </Tag>
            ),
          },
        ]
      : []),
  ];

  return (
    <section className="content-view ranking-view">
      <SectionHeader
        theme={tema}
        title="Ranking da turma"
        description={
          credibilidadeAdicionada
            ? "Compare as duas formas de organizar a turma."
            : "Veja a classificação da turma pelo número de inscritos."
        }
        badge={
          <Tag variant="brand" size="sm" pill theme={tema}>
            Missão concluída
          </Tag>
        }
      />

      <div className="ranking-metrics">
        <MetricCard theme={tema} title="Sua posição agora" value={posicao ? `${posicao}º` : "—"} />
        <MetricCard theme={tema} title="Inscritos" value={props.inscritos.toLocaleString("pt-BR")} />
        {credibilidadeAdicionada && (
          <MetricCard theme={tema} title="Fontes confiáveis" value={`${props.fontesConfiaveis}/${limite}`} />
        )}
      </div>

      {credibilidadeAdicionada ? (
        <>
          <Tabs
            theme={tema}
            variant="pill"
            value={modo}
            onChange={(valor) => props.aoOrdenar(valor as ModoRanking)}
            /* `showIcon: false` — sem ele o `Tab` desenha um glifo padrão de "+"
               antes do rótulo, que aqui não quer dizer nada. */
            items={[
              { value: "confiaveis", label: "Mais fontes confiáveis", showIcon: false },
              { value: "inscritos", label: "Mais inscritos", showIcon: false },
            ]}
          />
          <AlertBox
            theme={tema}
            variant="warning"
            role="status"
            title="Ter muitos inscritos não significa contar a verdade."
          />
        </>
      ) : (
        <Button theme={tema} variant="primary" size="lg" onClick={props.aoAdicionarCredibilidade}>
          Adicionar credibilidade
        </Button>
      )}

      <Table<RankingLinha>
        theme={tema}
        zebra
        size="md"
        columns={colunas}
        data={linhas}
        keyExtractor={(linha) => `${modo}-${linha.id}`}
        loading={!ranking}
        emptyText="Carregando a turma"
        className="ranking-table"
      />
    </section>
  );
}
